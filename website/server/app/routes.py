import httpx
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from app.models import GenerateRequest, GenerateResponse, UserStoryResponse
from app.models import RefineRequest, RefineResponse
from app.services.llm_client import get_plot_code
from app.services.code_runner import run_python
from app.services.llm_orchestrator import generate_and_execute
from app.userstories import user_stories
from fastapi.responses import FileResponse, JSONResponse
from typing import List
import os, json, shutil
import pandas as pd


router = APIRouter(prefix="/api", tags=["generate"])

json_path = os.path.join(os.getcwd(), "visualizations.json")
with open(json_path,"r") as f:
    user_story_visuals = json.load(f)

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
    "model_name": "DeepSeek-R1",
    "language": "python",
    "library": "plotly",
    "isDVL": true
    }`
    """
    try:
        result = generate_and_execute(provider="jetstream",model_name=req.model,execution_env=req.language,library=req.library,filename_prefix=f"test")
        code = result["code"]
        output_file = result["output_html_path"]
        filename = output_file.split("/")[-1]  # test.html
        output_path = f"/static-output/{filename}"
        # image_b64 = run_python(code)
        return GenerateResponse(code=code, output_path=output_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

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
    file_path = f"/code/data/output/{filename}.html" 
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=filename, media_type='text/html')

# After mvp0


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
    CSV_PATH = os.path.join(os.path.dirname(__file__), "..","data", "input", filename)
    if not os.path.exists(CSV_PATH):
        raise HTTPException(status_code=404, detail="CSV file not found")

    try:
        df = pd.read_csv(CSV_PATH)
        top_rows = df.head(n)
        return top_rows.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refine", response_model=RefineResponse, summary="Refine an existing visualization")
async def refine_visualization(req: RefineRequest):
    """
    Refine an existing visualization based on a user-provided refinement prompt.

    Request Body:
    - `user_story_id`: ID of the user story to which the original visualization belongs.
    - `language`: The programming language used (e.g., Python).
    - `library`: The visualization library used (e.g., matplotlib).
    - `original_code`: The original code that generated the visualization.
    - `refinement_prompt`: A natural language instruction describing how to modify the visualization.

    Returns:
    - `updated_code`: Modified version of the original code.
    - `output_path`:  path of the refined visualization.

    Example Input:
    `{
    "user_story_id": 1,
    "language": "python",
    "library": "plotly",
    "original_code": "import .... ",
    "refinement_prompt": "change colors ... "
    }`

    """

    # `refinement_prompt`: A natural language instruction describing how to modify the visualization.
    # Raises:
    # - 400 Bad Request: If the refinement cannot be processed.
    # - 500 Internal Server Error: For any other processing errors.
    try:
        # === Placeholder logic ===
        # call LLM 
        # updated_code = req.original_code + f"\n# Refined with: {req.refinement_prompt}"
        # output_path = run_python(updated_code)  # assuming you have a safe sandboxed runner

        return RefineResponse(
            updated_code=req.refinement_prompt,
            output_path="/app/code/ref/viz1.html"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refinement failed: {str(e)}")
    
# @router.get("/userstory/{us_id}")
# def get_all_visualizations(us_id: str):
#     try:
#         return user_story_visuals[us_id]
#     except KeyError:
#         raise HTTPException(status_code=404, detail="User story not found")
    
@router.get("/userstory/{us_id}")
def get_all_visualizations(us_id: str):
    try:
        story_data = user_story_visuals[us_id]
        result = []
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