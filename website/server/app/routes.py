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

router = APIRouter(prefix="/api", tags=["generate"])

json_path = os.path.join(os.getcwd(), "visualizations.json")
with open(json_path,"r") as f:
    user_story_visuals = json.load(f)
# test
# DEFAULT_JSON = Path(__file__).resolve().parents[1] / "visualizations.json"
# JSON_PATH = Path(os.getenv("VISUALS_JSON", DEFAULT_JSON))

orchestrator = None
_last_generation_ctx = {
    "execution_env": None,
    "library": None,
    "filename_prefix": None,
}
#
# @router.post("/generate", response_model=GenerateResponse)
# def generate(req: GenerateRequest):
#     """
#     Generates visualization code based on the provided prompt using the selected LLM, language, and charting library.
#
#     - **model**: Name of the LLM to use (e.g., DeepSeek-R1)
#     - **language**: Programming language in which the code should be generated
#     - **library**: Charting library to use (e.g., Plotly, Matplotlib, Altair)
#     - **isDVL**: Set to true if using DVL framework constraints
#
#     This endpoint returns the generated code and a path to the rendered visualization output.
#
#     Example Input:
#     `{
#     "id":1,
#     "model_name": "DeepSeek-R1",
#     "language": "python",
#     "library": "plotly",
#     "isDVL": true
#     }`
#     """
#     global orchestrator
#     try:
#         orchestrator = LLMOrchestrator(
#             # provider="jetstream",
#             provider = stored_provider,
#             model_name=req.model,
#             llm_factory_api_key=stored_api_key,
#             prompt_file_path="/app/sdata/input/prompts/prompts_updated.json"
#         )
#
#         # 1. Initial Run
#         result = orchestrator.run(
#             execution_env=req.language, library=req.library,
#             filename_prefix=f"{req.model}{req.id}_{req.language}_{req.library}",
#             story_id=req.id
#         )
#         code = result["code"]
#         output_file = result["output_html_path"]
#         filename = output_file.split("/")[-1]  # test.html
#         # if req.id in (3,10): #directly serve static html files
#         #     output_path = output_file
#         # else:
#         output_path = f"/static-output/{filename}"
#         # image_b64 = run_python(code)
#         return GenerateResponse(code=code, output_path=output_path)
#     except Exception as exc:
#         raise HTTPException(status_code=500, detail=str(exc))

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

# to use the data folder in website works only after creating a image
# DATA_DIR = "/code/data"
# INPUT_DIR = os.path.join(DATA_DIR, "input")
# CSV_PATH = os.path.join(INPUT_DIR, "dvl-llm-1-hra-growth-over-time.csv")

# data in server folder

@router.get("/csv/top/{us_id}", summary="Get top N rows from user story data")
def get_top_rows(us_id: str, n: int = Query(5, gt=0, le=20)):
    """

    Retrieve the top `N` rows from the selected user story metadata CSV file.

    - us_id : id of the user story

    Returns a list of dictionaries, where each dictionary represents a row from the CSV file.

    This endpoint is typically used to preview sample data before full ingestion or visualization.
    """
    # GET /csv/top
    # Raises:
    # - 404 Not Found: If the CSV file does not exist at the expected path.
    # - 500 Internal Server Error: If an error occurs while reading or parsing the CSV.
    # """
    # Fetch top n rows from the CSV file.
    # """
    filename = f"{us_id}.csv"
    CSV_PATH = os.path.join(os.path.dirname(__file__), "..","sdata", "input", filename)
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
    user_stories = data.get("user_stories", {})
    if user_story_id not in user_stories:
        raise HTTPException(status_code=404, detail="User story not found")

    # 2) get refinements (should be a list)
    refinements = user_stories[user_story_id].get("refine_prompts", [])

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

# @router.post("/refine", response_model=RefineResponse, summary="Refine an existing visualization")
# async def refine_visualization(req: RefineRequest):
#     """
#     Refine an existing visualization based on a user-provided refinement prompt.

#     Request Body:
#     - `user_story_id`: ID of the user story to which the original visualization belongs.
#     - `language`: The programming language used (e.g., Python).
#     - `library`: The visualization library used (e.g., matplotlib).
#     - `original_code`: The original code that generated the visualization.
#     - `refinement_prompt`: A natural language instruction describing how to modify the visualization.

#     Returns:
#     - `updated_code`: Modified version of the original code.
#     - `output_path`:  path of the refined visualization.

#     Example Input:
#     `{
#     "user_story_id": 1,
#     "language": "python",
#     "library": "plotly",
#     "original_code": "import .... ",
#     "refinement_prompt": "change colors ... "
#     }`

#     """

#     # `refinement_prompt`: A natural language instruction describing how to modify the visualization.
#     # Raises:
#     # - 400 Bad Request: If the refinement cannot be processed.
#     # - 500 Internal Server Error: For any other processing errors.
#     try:
#         # === Placeholder logic ===
#         # call LLM 
#         # updated_code = req.original_code + f"\n# Refined with: {req.refinement_prompt}"
#         # output_path = run_python(updated_code)  # assuming you have a safe sandboxed runner

#         return RefineResponse(
#             updated_code=req.refinement_prompt,
#             output_path="/app/code/ref/viz1.html"
#         )

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Refinement failed: {str(e)}")
    
# @router.get("/userstory/{us_id}")
# def get_all_visualizations(us_id: str):
#     try:
#         return user_story_visuals[us_id]
#     except KeyError:
#         raise HTTPException(status_code=404, detail="User story not found")
    
# @router.get("/userstory/{us_id}")
# def get_all_visualizations(us_id: str):
#     try:
#         story_data = user_story_visuals[us_id]
#         result = []
#         for language, libraries in story_data.items():
#             for library, llms in libraries.items():
#                 for llm, content in llms.items():
#                     result.append({
#                         "language": language,
#                         "library": library,
#                         "llm": llm,
#                         "code": content["code"] + " "+" Check "+language + library + llm + "  user story" + us_id,
#                         "image_url": content["image_url"]
#                     })
#         return result

#     except KeyError:
#         raise HTTPException(status_code=404, detail="User story not found")

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
                            "code": content["code"] + " "+" Check "+language + library + llm + "  user story" + us_id,
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
                            "code": content["code"] + " "+" Check "+language + library + llm + "  user story" + us_id,
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

    if orchestrator is None:
        error_detail = {
            "error_code": "NO_ACTIVE_SESSION",
            "error_message": "No active orchestrator session. Call /generate first.",
            "details": {"required_action": "Call /generate endpoint before using /refine"}
        }
        raise HTTPException(status_code=400, detail=error_detail)

    try:
        result = orchestrator.refine(req.prompt)
        # Check if the result indicates an error
        if result.get("status") == "error":
            error_code = result.get("error_code")
            error_message = result.get("error_message", "An unknown error occurred during refinement.")
            details = result.get("details", {})

            # Create error response with detailed information
            error_detail = {
                "error_code": error_code,
                "error_message": error_message,
                "details": details
            }
            raise HTTPException(status_code=500, detail=error_detail)
        if result.get("status") == "success":
            code = result["code"]
            output_file = result["output_html_path"]
            filename = output_file.split("/")[-1]
            output_path = f"/static-output/{filename}"
            thinking_text = result.get("thinking_text", "")

            return RefineResponse(
                updated_code=code,
                output_path=output_path,
                thinking_text=thinking_text
            )
            # return {
            #     "updated_code": code,
            #     "output_path": output_path,
            #     "thinking_text": thinking_text
            # }
    except Exception as exc:
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


# stored_api_key = None

# @router.post("/save-api-key")
# def save_api_key(api_key: str = Body(..., embed=True)):
#     """
#     Save the provided API key in memory for future use.
#     This is for local single-user use; no database persistence.
#     """
#     global stored_api_key
#     stored_api_key = api_key
#     return {"message": "API key saved successfully"}

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


#
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
    try:
        orchestrator = LLMOrchestrator(
            # provider="jetstream",
            provider = stored_provider,
            model_name=req.model,
            llm_factory_api_key=stored_api_key,
            prompt_file_path="/app/sdata/input/prompts/prompts_updated.json"
        )

        # 1. Initial Run
        result = orchestrator.run(
            execution_env=req.language, library=req.library,
            filename_prefix=f"{req.model}{req.id}_{req.language}_{req.library}",
            story_id=req.id
        )

        _last_generation_ctx.update({
            "execution_env": req.language,
            "library": req.library,
            "filename_prefix": f"{req.model}{req.id}_{req.language}_{req.library}",
        })

        # Check if the result indicates an error
        if result.get("status") == "error":
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
            raise HTTPException(status_code=500, detail=error_detail)

        # Handle success case
        if result.get("status") == "success":
            code = result["code"]
            output_file = result["output_html_path"]
            filename = output_file.split("/")[-1]  # test.html
            output_path = f"/static-output/{filename}"

            return GenerateResponse(code=code, output_path=output_path)

        # Handle unexpected result format
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
        full_error = traceback.format_exc()
        error_detail = {
            "error_code": "INTERNAL_SERVER_ERROR",
            "error_message": f"An unexpected error occurred: {str(exc)}",
            "details": {
                "traceback": full_error
            }
        }
        raise HTTPException(status_code=500, detail=error_detail)
#