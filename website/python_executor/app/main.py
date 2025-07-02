import os
import re
import uuid
import subprocess
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

app = FastAPI()

# --- Configuration ---
DATA_DIR = "/app/data"
OUTPUT_DIR = os.path.join(DATA_DIR, "output")
FORBIDDEN_KEYWORDS = [
    "import os", "import subprocess", "os.", "subprocess.", "eval(",
    "exec(", "shutil", "system(", "socket", "__import__"
]

# --- Self-contained and simplified error definitions ---
ERROR_DEFINITIONS = {
    1000: "Code Execution Error: The provided script failed during execution due to a runtime or syntax error.",
    1100: "Logical Error: The script ran without crashing but did not create the expected output file.",
    2000: "Service Level Error: The executor service encountered a problem.",
}

# --- Request/Response Models ---
class CodeRequest(BaseModel):
    code: str
    filename_prefix: str

def create_error_response(code: int, stderr: str = "", stdout: str = "") -> Dict[str, Any]:
    """Helper function to build the standard structured JSON error response."""
    return {
        "status": "error",
        "error_code": code,
        "error_message": ERROR_DEFINITIONS.get(code, "An unknown error occurred."),
        "details": {
            "stdout": stdout,
            "stderr": stderr
        }
    }

# --- API Endpoint ---
@app.post("/execute")
def execute_code(req: CodeRequest):
    # 1. Security Check -> This is a Service Level Error
    for keyword in FORBIDDEN_KEYWORDS:
        if keyword in req.code:
            # For HTTP-level errors, we still construct the same payload and pass it to 'detail'
            error_payload = create_error_response(2000, stderr=f"Security Violation: Forbidden keyword '{keyword}' detected.")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_payload)

    # 2. Prepare for execution
    uid = str(uuid.uuid4())[:8]
    code_file = f"/tmp/temp_{uid}.py"
    output_file = os.path.join(OUTPUT_DIR, f"{req.filename_prefix}.html")

    try:
        with open(code_file, "w") as f:
            f.write(req.code)

        # 3. Run the script
        result = subprocess.run(
            ["python", code_file],
            capture_output=True,
            text=True,
            timeout=30
        )

        # 4. Process the result
        if result.returncode == 0 and os.path.exists(output_file):
            return {"status": "success", "code": req.code, "output_html_path": output_file}
        else:
            if result.returncode == 0 and not os.path.exists(output_file):
                return create_error_response(1100, stdout=result.stdout, stderr="Script finished with exit code 0 but the output file was not found.")
            else:
                return create_error_response(1000, stderr=result.stderr, stdout=result.stdout)

    except subprocess.TimeoutExpired:
        error_payload = create_error_response(2000, stderr="Execution timed out after 30 seconds.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_payload)
    except Exception as e:
        error_payload = create_error_response(2000, stderr=f"An internal error occurred in the executor: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_payload)
    finally:
        # 5. Cleanup
        if os.path.exists(code_file):
            os.remove(code_file)