from pydantic import BaseModel, Field
from typing import List

class GenerateRequest(BaseModel):
    """
    What the Angular front-end will POST to /api/generate.
    """
    id: int = Field( default=1, description="User Story Id") 
    model: str = Field(
        ..., 
        examples=["DeepSeek-R1"], 
        description="Which LLM to use (e.g. Deepseek)"
    )
    language: str = Field(
        default="python",
        pattern="python",
        description="Target programming language ('python', 'R' or 'Java Script')"
    )
    library: str = Field(
        ..., 
        # examples=["Plotly","Matplotlib","Seaborn", "Altair"],
        example = "Plotly",
        description="Library to import/target in generated code"
    )
    isDVL: bool = Field(
        ..., 
        example = True,
        description="True if using the DVL framework, False otherwise"
    )

class GenerateResponse(BaseModel):
    """
    What backend will send back: the Python code and a path of visualization.
    """
    code: str
    output_path: str

class UserStoryResponse(BaseModel):
    id: int
    userstory: str
    description: str
    viz_types: List[str]
    image_url: str


class RefineRequest(BaseModel):
    user_story_id: int = Field(
    ..., 
    description="ID of the user story being refined"
    )
    language: str = Field(
    ..., 
    description="Programming language (e.g., 'python')"
    )
    library: str = Field(
    ..., 
    description="Charting library (e.g., 'matplotlib')"
    )
    original_code: str = Field(
    ..., 
    description="The original visualization code"
    )
    refinement_prompt: str = Field(
    ..., 
    description="User's textual request for refining the visualization"
    )


class RefineResponse(BaseModel):
    updated_code: str = Field(..., description="Modified visualization code after refinement")
    output_path: str = Field(..., description="path of the refined visualization")
