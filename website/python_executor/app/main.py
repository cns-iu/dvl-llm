from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import uuid
import os

app = FastAPI()

DATA_DIR = "/app/data"
INPUT_DIR = os.path.join(DATA_DIR, "input")
OUTPUT_DIR = os.path.join(DATA_DIR, "output")

# Dangerous keywords to reject in the code
FORBIDDEN_KEYWORDS = [
    "import os", "import subprocess", "os.", "subprocess.", "eval(",
    "exec(", "shutil", "system(", "socket", "__import__"
]

class CodeRequest(BaseModel):
    code: str
    filename_prefix: str

@app.post("/execute")
def execute_code(req: CodeRequest):
    # Basic keyword check
    for keyword in FORBIDDEN_KEYWORDS:
        if keyword in req.code:
            raise HTTPException(status_code=400, detail=f"Blocked keyword detected: {keyword}")

    # Generate a unique file name
    uid = str(uuid.uuid4())[:8]
    code_file = f"/tmp/temp_{uid}.py"

    try:
        # Write the code to a temporary file
        with open(code_file, "w") as f:
            f.write(req.code)

        # Run the script with a 30-second timeout
        result = subprocess.run(
            ["python", code_file],
            capture_output=True,
            text=True,
            timeout=30  # ⏱ Timeout in seconds
        )

        # Check if expected output file exists
        output_file = os.path.join(OUTPUT_DIR, f"{req.filename_prefix}.html")
        if result.returncode == 0 and os.path.exists(output_file):
            return {
                "status": "success",
                "output_html_path": output_file
            }
        else:
            return {
                "status": "error",
                "stdout": result.stdout,
                "stderr": result.stderr
            }

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="⏱ Code execution timed out (30 seconds).")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unhandled error: {str(e)}")

    finally:
        # Cleanup the temp code file
        if os.path.exists(code_file):
            os.remove(code_file)