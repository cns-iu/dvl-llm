import pytest
from unittest.mock import MagicMock, patch
import os
import sys

# --- FIX: Add the project root directory to the Python path ---
# This ensures that the 'server' module can be found when running pytest from the root
# Note: You might need to adjust this depending on your final project structure.
# If running `pytest` from the root `dvl-llm` directory, this should work.
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# --- CORRECTED IMPORT ---
# Correcting the class name and ensuring the path is findable.
# This assumes the test is run from the project root.
from server.app.services.llm_orchestrator import LLMOrchestrator
from langchain_core.messages import AIMessage  # <-- Import AIMessage

# --- Mock Data and Responses ---

# This simulates the first, buggy code returned by the LLM
BUGGY_PYTHON_CODE = "import pandas as pd\ndf = pd.DataFrame()\nprint(df['non_existent_column'])"

# This simulates the "fixed" code returned by the LLM on the second attempt
FIXED_PYTHON_CODE = "import pandas as pd\ndf = pd.DataFrame({'a': [1]})\nfig.write_html('/app/data/output/test.html')"

# This is the fake error response we will pretend the executor sent back first
FAKE_ERROR_RESPONSE = {
    "status": "error",
    "error_code": 1000,
    "error_message": "Code Execution Error...",
    "details": {
        "stdout": "",
        "stderr": "KeyError: 'non_existent_column'"
    }
}

# This is the fake success response we will send back on the retry
FAKE_SUCCESS_RESPONSE = {
    "status": "success",
    "output_html_path": "/app/data/output/test.html"
}


# The test function itself
def test_orchestrator_handles_error_and_retries_successfully():
    """
    Verifies that the Orchestrator can handle a correctable error (1000),
    re-prompt the LLM, and succeed on the second attempt.
    """
    # The paths for patching now refer to the module directly.
    with patch('server.app.services.llm_orchestrator.requests.post') as mock_post, \
            patch('server.app.services.llm_orchestrator.LLMFactory') as mock_llm_factory:
        # 1. --- Configure the Mocks ---

        # a. Configure the mock for requests.post
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: FAKE_ERROR_RESPONSE),  # First call
            MagicMock(status_code=200, json=lambda: FAKE_SUCCESS_RESPONSE)  # Second call (the retry)
        ]

        # b. Configure the mock for the LLM
        mock_llm = MagicMock()
        # --- FIX: Mock LLM must return AIMessage objects, not raw strings ---
        mock_llm.invoke.side_effect = [
            AIMessage(content=BUGGY_PYTHON_CODE),  # First call returns an AIMessage
            AIMessage(content=FIXED_PYTHON_CODE)  # Second call returns an AIMessage
        ]
        mock_llm_factory.return_value = mock_llm

        # 2. --- Run the Test ---

        # FIX: Construct the path to prompts.json relative to the orchestrator file itself
        orchestrator_dir = os.path.dirname(os.path.abspath(LLMOrchestrator.__file__))
        prompts_file_path = os.path.join(orchestrator_dir, 'prompts.json')

        # Instantiate the orchestrator with the corrected class name and correct path
        orchestrator = LLMOrchestrator(
            provider="jetstream",
            model_name="fake_model",
            max_retries=1,  # We only need to test one retry
            prompt_file_path=prompts_file_path  # Pass the correct path
        )

        # Call the main run method
        final_result = orchestrator.run(
            execution_env="python",
            library="plotly",
            filename_prefix="retry_test"
        )

        # 3. --- Assert the Behavior ---

        # a. Check that the final result is a success
        assert final_result is not None
        assert final_result.get("status") == "success"
        assert final_result.get("output_html_path") is not None

        # b. Verify that our mocks were called the correct number of times
        assert mock_post.call_count == 2, "Executor should have been called twice (initial + retry)"
        assert mock_llm.invoke.call_count == 2, "LLM should have been invoked twice (initial + correction)"

        # c. (Advanced) Verify the content of the retry prompt
        second_llm_call_args = mock_llm.invoke.call_args_list[1]
        chain_input = second_llm_call_args.args[0]
        # The prompt itself is the input to the chain, not a dict with 'messages'
        second_prompt_messages = chain_input

        last_message = second_prompt_messages[-1].content
        assert "The previously generated code failed" in last_message
        assert "KeyError: 'non_existent_column'" in last_message
        print("\nTest passed: Orchestrator correctly handled the error and retried successfully.")


# This allows you to run the test directly with `python test_orchestrator.py`
if __name__ == "__main__":
    test_orchestrator_handles_error_and_retries_successfully()
