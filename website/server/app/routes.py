import httpx
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Body
from app.models import GenerateRequest, GenerateResponse, UserStoryResponse
from app.models import RefineRequest, RefineResponse, UndoResponse
from app.services.llm_orchestrator import LLMOrchestrator
from app.userstories import user_stories
from fastapi.responses import FileResponse, JSONResponse
from typing import List
import os, json, shutil
import pandas as pd
from pathlib import Path
from typing import List, Optional
from jinja2.sandbox import SandboxedEnvironment
from jinja2 import StrictUndefined
import re
import time
import traceback
from datetime import datetime

router = APIRouter(prefix="/api", tags=["generate"])

json_path = os.path.join(os.getcwd(), "visualizations.json")
with open(json_path, "r") as f:
    user_story_visuals = json.load(f)
# test
# DEFAULT_JSON = Path(__file__).resolve().parents[1] / "visualizations.json"
# JSON_PATH = Path(os.getenv("VISUALS_JSON", DEFAULT_JSON))

orchestrator = None
_last_generation_ctx = {
    "execution_env": None,
    "library": None,
    "filename_prefix": None,
    "story_id": None,
    "model_name": None,
}

# -------- Latency logging setup --------
LOG_DIR = "/app/data/logs"
LOG_FILE: Optional[str] = None


def ensure_log_file() -> None:
    """
    Create a timestamped latency log file under /app/data/logs
    when the orchestrator is first initialized.
    """
    global LOG_FILE
    if LOG_FILE is None:
        os.makedirs(LOG_DIR, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        LOG_FILE = os.path.join(LOG_DIR, f"latency_log_{ts}.txt")


def log_latency(
        action: str,
        user_story_id,
        provider: Optional[str],
        model_name: Optional[str],
        execution_env: Optional[str],
        library: Optional[str],
        start_time_str: Optional[str],
        end_time_str: Optional[str],
        time_taken,
) -> None:
    """
    Append a single latency record.

    Format:
    action,user_story_id,provider,model_name,execution_env,library,start_time,end_time,time_taken
    """
    try:
        # Safety: ensure log file exists
        ensure_log_file()
        line = f"{action},{user_story_id},{provider},{model_name},{execution_env},{library},{start_time_str},{end_time_str},{time_taken}\n"
        with open(LOG_FILE, "a") as f:
            f.write(line)
    except Exception:
        # Never break the API because of logging errors.
        pass


# --------------------------------------


@router.get("/download/{filename}")
def download_visualization(filename: str):
    """
    Returns a generated visualization HTML file for download.

    This endpoint allows clients to retrieve a previously generated file,
    identified by its filename, and serves it with appropriate headers to trigger download.

    - **filename**: Name of the file (without `.html` extension)

    Note: This is typically used after calling the `/generate` endpoint,
    where the file path is returned for both rendering the visualization.
    """
    # file_path = f"/code/data/output/{filename}.html"
    file_path = f"/app/data/output/{filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    if filename.lower().endswith('.png'):
        media_type = 'image/png'
    elif filename.lower().endswith('.html'):
        media_type = 'text/html'
    else:
        # Default to octet-stream for unknown file types
        media_type = 'application/octet-stream'
    return FileResponse(file_path, filename=filename, media_type=media_type)


@router.get("/userstories", response_model=List[UserStoryResponse])
def get_userstories():
    """
    Returns a list of all defined user stories along with their metadata.

    Each user story object includes:
    - id : Unique identifier of the user story.
    - userstory : User story Name (e.g., HRA Growth over time).
    - description : Short textual description of the user story.
    - viz_Types: List of supported or recommended visualization types.

    This endpoint is typically used to populate selection menus,
    provide contextual information about available user stories.

    """
    # Response:
    #     200 OK: List[UserStoryResponse]
    return user_stories


@router.get(
    "/userstories/{userstory_id}",
    response_model=UserStoryResponse,
    summary="Get a single user story by ID",
)
def get_userstory(userstory_id: int):
    """
    Returns the user story whose `id` matches `userstory_id`.

    - **userstory_id**: Unique identifier of the user story.

    Raises 404 if not found.
    """
    for story in user_stories:
        if story.id == userstory_id:
            return story
    raise HTTPException(status_code=404, detail=f"User story {userstory_id} not found")


# data in server folder

@router.get("/csv/top/{us_id}", summary="Get top N rows from user story data")
def get_top_rows(us_id: str, n: int = Query(5, gt=0, le=20)):
    """

    Retrieve the top `N` rows from the selected user story metadata CSV file.

    - us_id : id of the user story

    Returns a list of dictionaries, where each dictionary represents a row from the CSV file.

    This endpoint is typically used to preview sample data before full ingestion or visualization.
    """
    filename = f"{us_id}.csv"
    CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "sdata", "input", filename)
    if not os.path.exists(CSV_PATH):
        raise HTTPException(status_code=404, detail="CSV file not found")

    try:
        df = pd.read_csv(CSV_PATH)
        top_rows = df.head(n)
        return top_rows.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


_jinja_env = SandboxedEnvironment(
    undefined=StrictUndefined,
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)


def _render_value(val: object, context: dict) -> object:
    if not isinstance(val, str):
        return val
    tmpl = _jinja_env.from_string(val)
    return tmpl.render(**context)


def _render_obj(obj: object, context: dict) -> object:
    if isinstance(obj, dict):
        return {k: _render_obj(v, context) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_render_obj(v, context) for v in obj]
    return _render_value(obj, context)


REFINEMENT_FILE = os.path.join("sdata", "input", "prompts", "prompts_updated.json")


@router.get("/refinements/{user_story_id}")
def get_refinements(user_story_id: str):
    if not os.path.exists(REFINEMENT_FILE):
        raise HTTPException(status_code=500, detail="Refinement data file not found")

    with open(REFINEMENT_FILE, "r") as f:
        data = json.load(f)

    # 1) make sure the story exists
    user_stories_data = data.get("user_stories", {})
    if user_story_id not in user_stories_data:
        raise HTTPException(status_code=404, detail="User story not found")

    # 2) get refinements (should be a list)
    refinements = user_stories_data[user_story_id].get("refine_prompts", [])

    # 3) validate
    if not isinstance(refinements, list) or not refinements:
        raise HTTPException(status_code=404, detail="No refinements found for this user story")

    context = {
        "execution_env": _last_generation_ctx["execution_env"],
        "library": _last_generation_ctx["library"],
        "filename_prefix": _last_generation_ctx["filename_prefix"],
        "previous_filename_prefix": _last_generation_ctx["filename_prefix"],
    }

    try:
        rendered = _render_obj(refinements, context)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Template rendering error: {e}")

    return rendered


@router.get("/userstory/{us_id}")
def get_all_visualizations(us_id: str):
    try:
        story_data = user_story_visuals[us_id]
        result = []

        if us_id in ["3", "10"]:
            for language, libraries in story_data.items():
                for library, llms in libraries.items():
                    for llm, content in llms.items():
                        result.append({
                            "language": language,
                            "library": library,
                            "llm": llm,
                            "code": content[
                                        "code"] + " " + " Check " + language + library + llm + "  user story" + us_id,
                            "image_url": content["image_url"]
                        })
            return result

        # Define provider to LLM mapping
        provider_llm_mapping = {
            "jetstream": ["DeepSeek-R1", "llama-4-scout"],
            "google": ["gemini-2.5-flash"],
            "openai": ["gpt-4o"]
        }

        # Get allowed LLMs based on provider
        if stored_provider is None:
            allowed_llms = None  # Return all
        else:
            allowed_llms = provider_llm_mapping.get(stored_provider.lower(), [])

        for language, libraries in story_data.items():
            for library, llms in libraries.items():
                for llm, content in llms.items():
                    # Filter by provider if specified
                    if allowed_llms is None or llm in allowed_llms:
                        result.append({
                            "language": language,
                            "library": library,
                            "llm": llm,
                            "code": content[
                                        "code"] + " " + " Check " + language + library + llm + "  user story" + us_id,
                            "image_url": content["image_url"]
                        })

        return result

    except KeyError:
        raise HTTPException(status_code=404, detail="User story not found")


@router.get("/userstory/{us_id}/{language}/{library}/{llm}")
def get_visualization(us_id: str, language: str, library: str, llm: str):
    try:
        data = user_story_visuals[us_id][language][library][llm]
        return {
            "code": data["code"],
            "image_url": data["image_url"]
        }
    except KeyError:
        raise HTTPException(status_code=404, detail="Visualization not found")


UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "input")


@router.post("/csv/upload", summary="Upload an Excel file to the input folder")
async def upload_excel(file: UploadFile = File(...)):
    """
    Upload an Excel (.xlsx or .xls) file and save it in the input folder.
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are allowed")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    save_path = os.path.join(UPLOAD_DIR, file.filename)

    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return JSONResponse(content={"message": f"File '{file.filename}' uploaded successfully"}, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@router.post("/refine", response_model=RefineResponse)
def refine(req: RefineRequest):
    global orchestrator

    # Context for logging
    ctx_story_id = _last_generation_ctx.get("story_id")
    ctx_execution_env = _last_generation_ctx.get("execution_env")
    ctx_library = _last_generation_ctx.get("library")
    ctx_model_name = _last_generation_ctx.get("model_name")

    start_ts = datetime.now().isoformat()

    if orchestrator is None:
        end_ts = datetime.now().isoformat()
        error_detail = {
            "error_code": "NO_ACTIVE_SESSION",
            "error_message": "No active orchestrator session. Call /generate first.",
            "details": {"required_action": "Call /generate endpoint before using /refine"}
        }
        # Log NA latency since this is an error case
        log_latency(
            "refine",
            ctx_story_id,
            stored_provider,
            ctx_model_name,
            ctx_execution_env,
            ctx_library,
            start_ts,
            end_ts,
            "NA",
        )
        raise HTTPException(status_code=400, detail=error_detail)

    start_time = time.time()

    try:
        result = orchestrator.refine(req.prompt)
        # Check if the result indicates an error
        if result.get("status") == "error":
            end_ts = datetime.now().isoformat()

            error_code = result.get("error_code")
            error_message = result.get("error_message", "An unknown error occurred during refinement.")
            details = result.get("details", {})

            # Log NA for error
            log_latency(
                "refine",
                ctx_story_id,
                stored_provider,
                ctx_model_name,
                ctx_execution_env,
                ctx_library,
                start_ts,
                end_ts,
                "NA",
            )

            # Create error response with detailed information
            error_detail = {
                "error_code": error_code,
                "error_message": error_message,
                "details": details
            }
            raise HTTPException(status_code=500, detail=error_detail)

        if result.get("status") == "success":
            elapsed = time.time() - start_time
            end_ts = datetime.now().isoformat()

            code = result["code"]
            output_file = result["output_html_path"]
            filename = output_file.split("/")[-1]
            output_path = f"/static-output/{filename}"
            thinking_text = result.get("thinking_text", "")

            # Log successful refine
            log_latency(
                "refine",
                ctx_story_id,
                stored_provider,
                ctx_model_name,
                ctx_execution_env,
                ctx_library,
                start_ts,
                end_ts,
                elapsed,
            )

            return RefineResponse(
                updated_code=code,
                output_path=output_path,
                thinking_text=thinking_text
            )
    except HTTPException:
        # Already logged above where appropriate
        raise
    except Exception as exc:
        end_ts = datetime.now().isoformat()
        # Unexpected error: log NA
        log_latency(
            "refine",
            ctx_story_id,
            stored_provider,
            ctx_model_name,
            ctx_execution_env,
            ctx_library,
            start_ts,
            end_ts,
            "NA",
        )
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/undo", response_model=UndoResponse, summary="Undo last action and revert to previous visualization")
def undo_last_action():
    global orchestrator

    if orchestrator is None:
        # No session yet (same behavior style as /refine)
        raise HTTPException(status_code=400, detail="No active orchestrator session. Call /generate first.")

    try:
        result = orchestrator.undo()  # returns previous_state.result (or an error dict)

        # If the service returns an error dict, surface it as 400
        if result.get("status") == "error":
            # Use the service's error payload
            return UndoResponse(
                status="error",
                error_code=result.get("error_code"),
                error_message=result.get("error_message"),
            )

        # Map to the same fields in /refine
        code = result.get("code")
        output_file = result.get("output_html_path")

        output_path = None
        if output_file:
            filename = output_file.split("/")[-1]
            output_path = f"/static-output/{filename}"

        return UndoResponse(
            status="success",
            updated_code=code,
            output_path=output_path,
            message="Reverted to previous state."
        )

    except HTTPException:
        # Let FastAPI-propagated HTTP errors bubble up unchanged
        raise
    except Exception as exc:
        # Any unexpected error -> 500
        raise HTTPException(status_code=500, detail=str(exc))


stored_api_key = None
stored_provider = None


@router.post("/save-api-key")
def save_api_key(api_key: str = Body(..., embed=True), provider: str = Body(..., embed=True)):
    """
    Save the provided API key and provider in memory for future use.
    This is for local single-user use; no database persistence.
    """
    global stored_api_key, stored_provider
    stored_api_key = api_key
    stored_provider = provider
    return {"message": "API key saved successfully"}


@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    """
    Generates visualization code based on the provided prompt using the selected LLM, language, and charting library.

    - **model**: Name of the LLM to use (e.g., DeepSeek-R1)
    - **language**: Programming language in which the code should be generated
    - **library**: Charting library to use (e.g., Plotly, Matplotlib, Altair)
    - **isDVL**: Set to true if using DVL framework constraints

    This endpoint returns the generated code and a path to the rendered visualization output.

    Example Input:
    `{
    "id":1,
    "model_name": "DeepSeek-R1",
    "language": "python",
    "library": "plotly",
    "isDVL": true
    }`
    """
    global orchestrator

    def sanitize_for_filename(s: str) -> str:
        """Replace all non-alphanumeric chars with hyphen, lowercase result."""
        s = (s or "").strip().lower()
        return re.sub(r'[^a-z0-9]+', '-', s).strip('-') or "viz"

    start_ts = datetime.now().isoformat()
    start_time = time.time()

    try:
        orchestrator = LLMOrchestrator(
            # provider="jetstream",
            provider=stored_provider,
            model_name=req.model,
            llm_factory_api_key=stored_api_key,
            prompt_file_path="/app/sdata/input/prompts/prompts_updated.json"
        )

        # Create timestamped log file the first time an orchestrator is initialized
        ensure_log_file()

        cleaned_library_name = sanitize_for_filename(req.library)

        # 1. Initial Run
        result = orchestrator.run(
            execution_env=req.language, library=req.library,
            filename_prefix=f"{req.model}{req.id}_{req.language}_{cleaned_library_name}",
            story_id=req.id
        )

        _last_generation_ctx.update({
            "execution_env": req.language,
            "library": req.library,
            "filename_prefix": f"{req.model}{req.id}_{req.language}_{cleaned_library_name}",
            "story_id": req.id,
            "model_name": req.model,
        })

        # Check if the result indicates an error
        if result.get("status") == "error":
            end_ts = datetime.now().isoformat()

            # Extract error information
            error_code = result.get("error_code")
            error_message = result.get("error_message", "An unknown error occurred.")
            details = result.get("details", {})

            # error response with detailed information
            error_detail = {
                "error_code": error_code,
                "error_message": error_message,
                "details": details
            }

            # Log NA for error
            log_latency(
                "generate",
                req.id,
                stored_provider,
                req.model,
                req.language,
                req.library,
                start_ts,
                end_ts,
                "NA",
            )

            raise HTTPException(status_code=500, detail=error_detail)

        # Handle success case
        if result.get("status") == "success":
            elapsed = time.time() - start_time
            end_ts = datetime.now().isoformat()

            code = result["code"]
            output_file = result["output_html_path"]
            if req.id in (3, 10):
                output_path = output_file
            else:
                filename = output_file.split("/")[-1]  # test.html
                output_path = f"/static-output/{filename}"

            # Log successful generate
            log_latency(
                "generate",
                req.id,
                stored_provider,
                req.model,
                req.language,
                req.library,
                start_ts,
                end_ts,
                elapsed,
            )

            return GenerateResponse(code=code, output_path=output_path)

        # Handle unexpected result format
        end_ts = datetime.now().isoformat()
        log_latency(
            "generate",
            req.id,
            stored_provider,
            req.model,
            req.language,
            req.library,
            start_ts,
            end_ts,
            "NA",
        )
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "UNEXPECTED_RESULT_FORMAT",
                "error_message": "Unexpected result format from orchestrator",
                "details": {"result": result}
            }
        )

    except HTTPException:
        # Re-raise HTTPExceptions (our custom error responses)
        raise
    except Exception as exc:
        # Handle any other unexpected exceptions
        end_ts = datetime.now().isoformat()
        full_error = traceback.format_exc()

        # Log unexpected error with NA
        log_latency(
            "generate",
            req.id,
            stored_provider,
            req.model,
            req.language,
            req.library,
            start_ts,
            end_ts,
            "NA",
        )

        error_detail = {
            "error_code": "INTERNAL_SERVER_ERROR",
            "error_message": f"An unexpected error occurred: {str(exc)}",
            "details": {
                "traceback": full_error
            }
        }
        raise HTTPException(status_code=500, detail=error_detail)
#