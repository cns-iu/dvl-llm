import os
import re
import json
import requests
import pprint
from typing import List, Dict, Any, Optional, NamedTuple
import copy

# Assuming your LLMFactory and LangChain imports are in a shared location
from llm_factory import LLMFactory
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate


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
            "python": "http://localhost:5001/execute",  # Using localhost for local testing
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
        # --- NEW: Define the host path for the shared output directory ---
        # This assumes the script is run from a directory where './data/output' is accessible.
        self.host_output_path = os.path.abspath("../../../data/output")

    def _load_prompts(self, filepath: str):
        """Loads system, user, and error prompts from a JSON file."""
        try:
            with open(filepath, 'r') as f:
                prompts = json.load(f)
            self.system_prompt = SystemMessage(content=prompts["system_prompt"])
            self.initial_user_prompt_template = prompts["initial_user_prompt"]
            self.error_prompts = {
                1000: prompts["error_correction_prompt_1000"],
                1100: prompts["error_correction_prompt_1100"],
            }
        except (FileNotFoundError, KeyError) as e:
            print(f"FATAL: Could not load prompts from '{filepath}'. Error: {e}")
            raise

    def _extract_code(self, raw_text: str) -> str:
        """Extracts raw code from a string, removing markdown backticks."""
        match = re.search(r"```(?:python|r|javascript)?\n(.*?)```", raw_text, re.DOTALL)
        return match.group(1).strip() if match else raw_text.strip()

    def _execute_code(self, execution_env: str, code: str, filename_prefix: str) -> Dict[str, Any]:
        """Routes code to the correct executor microservice."""
        url = self.executor_urls.get(execution_env.lower())
        if not url:
            return {"status": "error", "error_code": 2000,
                    "error_message": f"Service Level Error: No executor for '{execution_env}'."}
        try:
            response = requests.post(url, json={"code": code, "filename_prefix": filename_prefix}, timeout=40)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"status": "error", "error_code": 2000,
                    "error_message": "Service Level Error: Could not connect to executor.",
                    "details": {"stderr": str(e)}}

    def _generation_and_execution_loop(self) -> Dict[str, Any]:
        """
        The private core engine. It contains the retry loop and handles
        the full generate -> execute -> handle error cycle.
        """
        self.iteration_count += 1
        current_filename_prefix = f"{self.base_filename_prefix}_{self.iteration_count}"

        for attempt in range(self.max_retries + 1):
            print(f"\n--- Iteration {self.iteration_count}, Attempt {attempt + 1} ---")
            print(f"--- Saving output to: {current_filename_prefix}.html ---")

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
            result = self._execute_code(self.execution_env, generated_code, current_filename_prefix)

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

    def run(self, execution_env: str, library: str, filename_prefix: str = "llm_generated_chart") -> Dict[str, Any]:
        """
        Starts the initial conversation and executes the first task.
        """
        print("--- Starting Initial Orchestration ---")
        self.execution_env = execution_env
        self.base_filename_prefix = filename_prefix

        initial_suffixed_filename = f"{self.base_filename_prefix}_1"
        initial_prompt = self.initial_user_prompt_template.format(
            execution_env=execution_env, library=library, filename_prefix=initial_suffixed_filename
        )
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
        full_refine_prompt = (
            f"{refine_prompt}\n\n"
            f"IMPORTANT: Please save the new output to '{new_suffixed_filename}.html'."
        )
        self.messages.append(HumanMessage(content=full_refine_prompt))

        result = self._generation_and_execution_loop()
        self._save_state(result)
        return result

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


if __name__ == '__main__':
    # --- How to Use the DvlOrchestrator Class with Undo ---

    orchestrator = LLMOrchestrator(
        provider="jetstream",
        model_name="DeepSeek-R1",
        llm_factory_api_key="sk-d124b81a3ead4cbd95b77249ca755831",
        prompt_file_path="../../../data/input/prompts/prompts.json"
    )

    # 1. Initial Run
    initial_result = orchestrator.run(
        execution_env="python", library="plotly", filename_prefix="test_run"
    )
    print("\n--- 🏁 Final Result of Initial Run (Iteration 1) ---")
    pprint.pprint(initial_result)

    # 2. Refinement
    if initial_result.get("status") == "success":
        refine_result1 = orchestrator.refine(
            refine_prompt="Use a color scheme from color brewer for the biological group variable. Add a legend that shows the color scale used for biological groups"
        )
        print("\n--- Final Result of Refinement (Iteration 2) ---")
        pprint.pprint(refine_result1)

        refine_result2 = orchestrator.refine(
            refine_prompt="change the y-axis to reflect logarithmic scale"
        )
        print("\n--- Final Result of Refinement (Iteration 3) ---")
        pprint.pprint(refine_result2)

        # # 3. Undo the refinement
        # # Let's say we didn't like the bar chart and want to go back
        # undo_result = orchestrator.undo()
        # print("\n--- Result After Undo ---")
        # print("This result should match the output from the initial run.")
        # pprint.pprint(undo_result)
        #
        # # Verify the state
        # assert undo_result == refine_result1
        # assert orchestrator.iteration_count == 2
        # print("\nState successfully reverted.")