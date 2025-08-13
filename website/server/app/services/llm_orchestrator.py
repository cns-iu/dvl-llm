import os
import re
import json
import requests
import pprint
from typing import List, Dict, Any, Optional, NamedTuple
import copy
import json as py_json
import time
from datetime import datetime

from llm_factory import LLMFactory
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from jinja2 import Environment, StrictUndefined

import re
import json as py_json  # avoid conflict with loaded json module


# A simple structure to hold a snapshot of the orchestrator's state
class OrchestratorState(NamedTuple):
    messages: List[BaseMessage]
    iteration_count: int
    result: Dict[str, Any]


class LLMOrchestrator:
    """
    Orchestrates the generation and execution of data visualization code,
    with an automated error-handling and retry loop, supporting iterative refinement and undo.
    """

    def __init__(
            self,
            provider: str,
            model_name: str,
            prompt_file_path: str = "prompts.json",
            max_retries: int = 2,
            llm_factory_api_key: Optional[str] = None
    ):
        self.max_retries = max_retries
        self.executor_urls = {
            "python": "http://localhost:5001/execute",
            "r": "http://localhost:5002/execute",
            "javascript": "http://localhost:5003/execute"
        }
        self.llm = LLMFactory(
            provider=provider, model_name=model_name,
            default_jetstream_api_key=llm_factory_api_key, temperature=0
        )
        self._load_prompts(prompt_file_path)
        self.messages: List[BaseMessage] = []
        self.iteration_count = 0
        self.base_filename_prefix = ""
        self.state_history: List[OrchestratorState] = []
        self.jinja = Environment(
            undefined=StrictUndefined,  # fail fast if you forget to pass a variable
            trim_blocks=True,
            lstrip_blocks=True
        )
        # --- NEW: Define the host path for the shared output directory ---
        # This assumes the script is run from a directory where './data/output' is accessible.
        self.host_output_path = os.path.abspath("../../../data/output")

    def _render_template(self, template_str: str, context: dict) -> str:
        return self.jinja.from_string(template_str).render(**context)


    def _load_prompts(self, filepath: str):
        """Loads system, user, and error prompts from a JSON file."""
        try:
            with open(filepath, 'r') as f:
                prompts = json.load(f)

            self.prompts = prompts

            # Store system prompts by type
            # NEW
            self.system_prompts = {
                "python": prompts["system_prompts"]["python"],
                "r": prompts["system_prompts"]["r"],
                "javascript": prompts["system_prompts"]["javascript"],
                "js": prompts["system_prompts"]["javascript"]
            }

            self.error_prompts = {
                int(code): msg for code, msg in prompts["error_correction_prompts"].items()
            }
        except (FileNotFoundError, KeyError) as e:
            print(f"FATAL: Could not load prompts from '{filepath}'. Error: {e}")
            raise

    def _extract_code(self, raw_text: str) -> str:
        """Extracts raw code from a string, removing markdown backticks."""
        match = re.search(r"```(?:python|r|javascript)?\n(.*?)```", raw_text, re.DOTALL)
        return match.group(1).strip() if match else raw_text.strip()

    # def _execute_code(self, execution_env: str, code: str, filename_prefix: str) -> Dict[str, Any]:
    #     """Routes code to the correct executor microservice."""
    #     url = self.executor_urls.get(execution_env.lower())
    #     if not url:
    #         return {"status": "error", "error_code": 2000,
    #                 "error_message": f"Service Level Error: No executor for '{execution_env}'."}
    #     try:
    #         response = requests.post(url, json={"code": code, "filename_prefix": filename_prefix}, timeout=40)
    #         response.raise_for_status()
    #         return response.json()
    #     except requests.exceptions.RequestException as e:
    #         return {"status": "error", "error_code": 2000,
    #                 "error_message": "Service Level Error: Could not connect to executor.",
    #                 "details": {"stderr": str(e)}}
    # import ast

    def _sanitize_code(self, code: str, execution_env: str) -> str:
        try:
            code_clean = code.encode("utf-8", errors="ignore").decode("utf-8")

            # Only strip control chars for JavaScript
            if execution_env.lower() in ["javascript", "js"]:
                code_clean = re.sub(r"[\x00-\x1F\x7F]", "", code_clean)

            return code_clean
        except Exception as e:
            print(f"[WARN] Failed to sanitize code properly: {e}")
            return code

    def _execute_code(self, execution_env: str, code: str, filename_prefix: str) -> Dict[str, Any]:
        url = self.executor_urls.get(execution_env.lower())
        if not url:
            return {
                "status": "error",
                "error_code": 2000,
                "error_message": f"Service Level Error: No executor for '{execution_env}'."
            }

        # --- CLEANING: Ensure UTF-8 and strip null/control characters ---
        code_clean = self._sanitize_code(code, execution_env)

        payload = {
            "code": code_clean,
            "filename_prefix": filename_prefix
        }

        # --- LOG: Print the actual payload being sent ---
        print(f"[DEBUG] Sending request to executor at {url}")
        print("[DEBUG] Full JSON Payload:")
        print(py_json.dumps(payload, indent=2))

        try:
            response = requests.post(url, json=payload, timeout=40)

            try:
                result = response.json()
            except ValueError:
                print("[ERROR] Invalid JSON in executor response")
                return {
                    "status": "error",
                    "error_code": 2001,
                    "error_message": "Invalid response format from executor.",
                    "details": {"stderr": response.text}
                }

            if response.status_code >= 400:
                print(f"[WARN] Executor returned error response: {result}")
                return result  # preserve error message from executor

            print(f"[DEBUG] Received response: {result}")
            return result

        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Executor connection failed: {e}")
            return {
                "status": "error",
                "error_code": 2000,
                "error_message": "Service Level Error: Could not connect to executor.",
                "details": {"stderr": str(e)}
            }


    def _generation_and_execution_loop(self) -> Dict[str, Any]:
        """
        The private core engine. It contains the retry loop and handles
        the full generate -> execute -> handle error cycle.
        """
        self.iteration_count += 1
        current_filename_prefix = f"{self.base_filename_prefix}_{self.iteration_count}"

        # Use .html as default if viz_file_format is not yet set (i.e., during .run())
        viz_file_format = getattr(self, "viz_file_format", ".html")
        output_filename = f"{current_filename_prefix}{viz_file_format}"

        for attempt in range(self.max_retries + 1):
            print(f"\n--- Iteration {self.iteration_count}, Attempt {attempt + 1} ---")
            print(f"--- Saving output to: {output_filename} ---")

            print("\n--- Sending Prompt to LLM ---")
            pprint.pprint(self.messages)
            print("---------------------------\n")

            print("Generating code...")
            chain = ChatPromptTemplate.from_messages(self.messages) | self.llm | StrOutputParser()
            generated_code = self._extract_code(chain.invoke({}))

            if self.messages[-1].type == "human":
                self.messages.append(AIMessage(content=generated_code))
            else:
                self.messages[-1] = AIMessage(content=generated_code)

            print("Executing code...")
            print(generated_code)
            result = self._execute_code(self.execution_env, generated_code, output_filename)

            if result.get("status") == "success":
                print("\n--- ✅ Attempt Successful! ---")
                return result

            error_code = result.get("error_code")
            print(f"Execution failed with error code: {error_code}")

            if error_code in self.error_prompts:
                if attempt < self.max_retries:
                    print("This is a correctable error. Preparing retry prompt...")
                    error_prompt_template = self.error_prompts[error_code]
                    correction_prompt = error_prompt_template.format(**result.get("details", {}))
                    self.messages.append(HumanMessage(content=correction_prompt))
                    continue
                else:
                    print("Max retries reached. Aborting.")
                    return result
            else:
                print("FATAL: A non-recoverable or unknown error occurred. Aborting.")
                return result

        return {"status": "error", "error_code": 9999, "error_message": "Orchestration failed after maximum retries."}

    def _save_state(self, result: Dict[str, Any]):
        """Saves the current state to the history stack."""
        state = OrchestratorState(
            messages=copy.deepcopy(self.messages),
            iteration_count=self.iteration_count,
            result=result
        )
        self.state_history.append(state)

    def run(self, execution_env: str, library: str, filename_prefix: str = "llm_generated_chart", story_id: str = "1") -> Dict[str, Any]:
        """
        Starts the initial conversation and executes the first task.
        """
        print("--- Starting Initial Orchestration ---")
        self.execution_env = execution_env
        self.library = library
        self.base_filename_prefix = filename_prefix

        initial_suffixed_filename = f"{self.base_filename_prefix}_1"

        self.story = self.prompts.get("user_stories", {}).get(story_id)
        if not self.story:
            return {"status": "error", "error_code": 3002, "error_message": f"User story '{story_id}' not found."}

        initial_prompt_template = self.story["initial_prompt"]
        self.refine_prompts = self.story.get("refine_prompts", [])

        context = {
            "execution_env": execution_env,
            "library": library,
            "filename_prefix": initial_suffixed_filename,
            "story_id": story_id,
        }
        initial_prompt = self._render_template(initial_prompt_template, context)

        if ".png" in initial_prompt.lower():
            self.viz_file_format = '.png'
        elif ".svg" in initial_prompt.lower():
            self.viz_file_format = '.svg'
        elif ".jpg" in initial_prompt.lower():
            self.viz_file_format = '.jpg'
        elif ".jpeg" in initial_prompt.lower():
            self.viz_file_format = '.jpeg'
        elif ".pdf" in initial_prompt.lower():
            self.viz_file_format = '.pdf'
        else:
            self.viz_file_format = '.html'

        system_prompt_text = self.system_prompts.get(execution_env.lower())

        if not system_prompt_text:
            return {"status": "error", "error_code": 3001,
                    "error_message": f"No system prompt available for execution environment '{execution_env}'."}

        self.system_prompt = SystemMessage(content=system_prompt_text)
        self.messages = [self.system_prompt, HumanMessage(content=initial_prompt)]

        result = self._generation_and_execution_loop()
        self._save_state(result)
        return result

    def refine(self, refine_prompt: str) -> Dict[str, Any]:
        """
        Adds a user's refinement prompt to the conversation and reruns the loop.
        """
        if not self.messages:
            return {"status": "error", "error_code": 3000,
                    "error_message": "Cannot refine. Please call .run() first to start a conversation."}

        print(f"\n--- Refining with prompt: '{refine_prompt}' ---")
        new_suffixed_filename = f"{self.base_filename_prefix}_{self.iteration_count + 1}"

        if ".png" in refine_prompt.lower():
            self.viz_file_format = '.png'
        elif ".svg" in refine_prompt.lower():
            self.viz_file_format = '.svg'
        elif ".jpg" in refine_prompt.lower():
            self.viz_file_format = '.jpg'
        elif ".jpeg" in refine_prompt.lower():
            self.viz_file_format = '.jpeg'
        elif ".pdf" in refine_prompt.lower():
            self.viz_file_format = '.pdf'

        # full_refine_prompt = (
        #     f"{refine_prompt}\n\n"
        #     f"IMPORTANT: Please save the new output to '{new_suffixed_filename}{self.viz_file_format}'."
        # )
        # self.messages.append(HumanMessage(content=full_refine_prompt))
        if self.execution_env.lower() in ('js', 'javascript'):
            context = {
                "execution_env": self.execution_env,
                "library": getattr(self, "library", ""),
                "previous_filename_prefix": f"{self.base_filename_prefix}_{self.iteration_count}"+".html",
                "filename_prefix": new_suffixed_filename,
                "story_id": getattr(self, "story", {}).get("id", ""),
            }
        else:
            context = {
                "execution_env": self.execution_env,
                "library": getattr(self, "library", ""),
                "filename_prefix": new_suffixed_filename,
                "story_id": getattr(self, "story", {}).get("id", "") }
        rendered_refine = self._render_template(refine_prompt, context)
        full_refine_prompt = (
            f"{rendered_refine}\n\n"
            f"IMPORTANT: Please save the new output to '{new_suffixed_filename}{self.viz_file_format}'."
        )
        self.messages.append(HumanMessage(content=full_refine_prompt))

        result = self._generation_and_execution_loop()
        self._save_state(result)
        return result


    def get_refine_options(self) -> List[Dict[str, str]]:
        """Return refine prompts for the current user story."""
        return getattr(self, "refine_prompts", [])


    def undo(self) -> Dict[str, Any]:
        """
        Reverts the orchestrator to its previous state, deletes the orphaned output
        file, and returns the result from the previous state.
        """
        print("\n--- Undoing Last Action ---")
        if len(self.state_history) <= 1:
            print("Cannot undo. Only the initial state exists.")
            return {"status": "error", "error_code": 4000,
                    "error_message": "Undo failed. No previous state to revert to."}

        # Pop the state that is being undone
        state_to_undo = self.state_history.pop()

        # --- NEW: File Deletion Logic ---
        undone_result = state_to_undo.result
        if undone_result.get("status") == "success":
            file_path_from_executor = undone_result.get("output_html_path")
            if file_path_from_executor:
                # Construct the path on the host machine
                filename = os.path.basename(file_path_from_executor)
                print(f"File path from executor: {filename}")
                host_path_to_delete = os.path.join(self.host_output_path, filename)
                try:
                    print(f"Attempting to delete orphaned file: {host_path_to_delete}")
                    os.remove(host_path_to_delete)
                    print(f"Successfully deleted {host_path_to_delete}")
                except FileNotFoundError:
                    print(f"Warning: Could not find file to delete at {host_path_to_delete}.")
                except Exception as e:
                    print(f"Warning: An error occurred while deleting file: {e}")

        # Get the new "last" state from the history
        previous_state = self.state_history[-1]

        # Restore the orchestrator's attributes from the previous state
        self.messages = copy.deepcopy(previous_state.messages)
        self.iteration_count = previous_state.iteration_count

        print(f"Reverted to iteration {self.iteration_count}. Returning previous result.")
        return previous_state.result

    import time
    from datetime import datetime

    def auto_refine_all(self, filename_prefix: str = "refine_timings") -> List[Dict[str, Any]]:
        """
        Iteratively applies all refine prompts using their description fields.
        Measures and logs average refinement time to a file in host_output_path.
        Continues even if some refinements fail.
        Appends execution_env and library to the log filename.
        """
        if not hasattr(self, "refine_prompts") or not self.refine_prompts:
            print("[WARN] No refine prompts available. Did you forget to call `.run()`?")
            return []

        results = []
        durations = []

        for idx, refine_entry in enumerate(self.refine_prompts, 1):
            description = refine_entry.get("description")
            if not description:
                print(f"[WARN] Skipping refine prompt #{idx}: missing description.")
                continue

            print(f"\n--- Auto Refinement #{idx}: {description} ---")

            start_time = time.time()
            result = self.refine(refine_prompt=description)
            end_time = time.time()

            elapsed = end_time - start_time
            durations.append(elapsed)
            results.append(result)

            print(f"[INFO] Refinement #{idx} took {elapsed:.2f} seconds")
            if result.get("status") != "success":
                print(f"[WARN] Refinement #{idx} failed but continuing...")

        avg_time = sum(durations) / len(durations) if durations else 0.0

        # --- Construct log filename with env and library ---
        env_safe = self.execution_env.replace(" ", "_").lower()
        lib_safe = getattr(self, "library", "unknown").replace(" ", "_").lower()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_filename = f"{filename_prefix}_{env_safe}_{lib_safe}_{timestamp}.txt"
        log_path = os.path.join(self.host_output_path, log_filename)

        # --- Save timing log to host output path ---
        try:
            os.makedirs(self.host_output_path, exist_ok=True)
            with open(log_path, "w") as f:
                f.write(f"Refinement timing log - {timestamp}\n")
                f.write(f"Execution Environment: {self.execution_env}\n")
                f.write(f"Library: {lib_safe}\n")
                f.write(f"Total refinements: {len(durations)}\n")
                f.write(f"Average time: {avg_time:.2f} seconds\n")
                for i, dur in enumerate(durations, 1):
                    f.write(f"Refinement #{i}: {dur:.2f} seconds\n")
            print(f"[✅] Timing info saved to: {log_path}")
        except Exception as e:
            print(f"[WARN] Failed to save timing log: {e}")

        return results


if __name__ == '__main__':
    from time import sleep
    import pprint

    python_test_cases = [
        # {"execution_env": "python", "library": "matplotlib", "filename_prefix": "test_python_matplotlib",
        #  "story_id": "1"},
        # {"execution_env": "python", "library": "altair", "filename_prefix": "linechartaltairaug4_python_altair", "story_id": "1"},
        # {"execution_env": "python", "library": "seaborn", "filename_prefix": "inechartaltairaug4_python_seaborn", "story_id": "1"},
        # {"execution_env": "python", "library": "pygal", "filename_prefix": "aug6pygal_python_pygal", "story_id": "1"},
        # {"execution_env": "python", "library": "bokeh", "filename_prefix": "linechartbokehaug4_python_bokeh", "story_id": "1"},
        # {"execution_env": "python", "library": "plotly", "filename_prefix": "linechartaug3_python_plotly", "story_id": "1"},
        # {"execution_env": "python", "library": "holoviews", "filename_prefix": "linechartaug6_python_holoviews",
        #  "story_id": "1"},
        # {"execution_env": "python", "library": "plotnine", "filename_prefix": "test_python_plotnine", "story_id": "1"},
        # {"execution_env": "python", "library": "plotly", "filename_prefix": "sankey_python_plotly", "story_id": "7"},
        # {"execution_env": "python", "library": "altair", "filename_prefix": "sankey_python_altair", "story_id": "7"},
        # {"execution_env": "python", "library": "seaborn", "filename_prefix": "sankey_python_seaborn", "story_id": "7"},
        # {"execution_env": "python", "library": "pysankey", "filename_prefix": "sankey_python_pysankey", "story_id": "7"},
        # {"execution_env": "python", "library": "bokeh", "filename_prefix": "sankey_python_bokeh", "story_id": "7"},
        # {"execution_env": "python", "library": "holoviews", "filename_prefix": "sankey_python_holoviews",
        #  "story_id": "7"},
        # {"execution_env": "python", "library": "networkx + PyVis", "filename_prefix": "sankey_python_networkxpyvis", "story_id": "7"},
    ]

    r_test_cases = [
        # {"execution_env": "r", "library": "ggplot2", "filename_prefix": "aug111linechartR_r_ggplot", "story_id": "1"},
        # {"execution_env": "r", "library": "default", "filename_prefix": "aug12linechartaug7R_r_default", "story_id": "1"},
        # {"execution_env": "r", "library": "lattice", "filename_prefix": "aug111linechartaug11R_r_lattice", "story_id": "1"},
        # {"execution_env": "r", "library": "plotly", "filename_prefix": "aug111linechartaug7R_r_plotly", "story_id": "1"},
        # {"execution_env": "r", "library": "base R", "filename_prefix": "aug12test_r_baseR", "story_id": "1"},
        # {"execution_env": "r", "library": "graphics", "filename_prefix": "aug12test_r_graphics", "story_id": "1"},
        # {"execution_env": "r", "library": "ggvis", "filename_prefix": "aug12test_r_ggvis", "story_id": "1"},
        # {
        #     "execution_env": "r",
        #     "library": "networkD3",
        #     "filename_prefix": "Aug12chromesankeyaug3_r_networkd3",
        #     "story_id": "7"
        # },
        # {
        #     "execution_env": "r",
        #     "library": "plotly",
        #     "filename_prefix": "sankeyaug3_r_plotly",
        #     "story_id": "7"
        # },
        # {
        #     "execution_env": "r",
        #     "library": "ggalluvial",
        #     "filename_prefix": "sankey_r_ggalluvial",
        #     "story_id": "7"
        # }
    ]

    js_test_cases = [
        # {"execution_env": "javascript", "library": "chart.js", "filename_prefix": "aug13test_js_chartjs", "story_id": "1"},
        # {"execution_env": "javascript", "library": "vega.js", "filename_prefix": "aug131test_js_vegajs", "story_id": "1"},
        {"execution_env": "javascript", "library": "plotly", "filename_prefix": "aug13test_js_plotly", "story_id": "1"},
        # {"execution_env": "javascript", "library": "d3.js", "filename_prefix": "aug12test_js_d3js", "story_id": "1"},
        # {"execution_env": "javascript", "library": "highcharts.js", "filename_prefix": "aug12test_js_highcharts",
        #  "story_id": "1"},
        # {"execution_env": "javascript", "library": "googlecharts.js", "filename_prefix": "aug12test_js_googlecharts",
        #  "story_id": "1"},
        # {"execution_env": "javascript", "library": "apache echarts.js", "filename_prefix": "aug12test_js_echarts",
        #  "story_id": "1"},
        # [
        #     {
        #         "execution_env": "javascript",
        #         "library": "d3.js",
        #         "filename_prefix": "sankey_js_d3",
        #         "story_id": "7"
        #     },
        #     {
        #         "execution_env": "javascript",
        #         "library": "googlecharts.js",
        #         "filename_prefix": "sankey_js_googlecharts",
        #         "story_id": "7"
        #     },
        #     {
        #         "execution_env": "javascript",
        #         "library": "apache_echarts.js",
        #         "filename_prefix": "sankey_js_apacheecharts",
        #         "story_id": "7"
        #     },
        #     {
        #         "execution_env": "javascript",
        #         "library": "highcharts.js",
        #         "filename_prefix": "sankey_js_highcharts",
        #         "story_id": "7"
        #     }
        # ]
    ]

    all_test_cases = python_test_cases + r_test_cases + js_test_cases

    for test in all_test_cases:
        print(f"\n--- Running test for {test['execution_env']} with {test['library']} ---")
        orchestrator = LLMOrchestrator(
            provider="jetstream",
            model_name="DeepSeek-R1",
            llm_factory_api_key="sk-d124b81a3ead4cbd95b77249ca755831",
            prompt_file_path="../../../data/input/prompts_updated.json"
        )
        result = orchestrator.run(
            execution_env=test["execution_env"],
            library=test["library"],
            filename_prefix=test["filename_prefix"],
            story_id=test["story_id"]
        )
        pprint.pprint(result)

        # Step 2: Apply all refinements
        print(f"\n--- 🔁 Running all refinements for {test['filename_prefix']} ---")
        refinement_results = orchestrator.auto_refine_all(filename_prefix=test["filename_prefix"])
        print(f"\n✅ Completed {len(refinement_results)} refinements for {test['filename_prefix']}.")

    