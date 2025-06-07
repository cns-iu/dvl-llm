from pydantic import BaseModel, Field

class GenerateRequest(BaseModel):
    """
    What the Angular front-end will POST to /api/generate.
    """
    model: str = Field(
        ..., 
        examples=["gpt-4o"], 
        description="Which LLM to use (e.g. ChatGPT)"
    )
    language: str = Field(
        default="python",
        pattern="python",
        description="Target programming language ('python', 'R' or 'Java Script')"
    )
    library: str = Field(
        ..., 
        examples=["Matplotlib","Seaborn", "Altair", "Plotly"],
        description="Library to import/target in generated code"
    )
    isDVL: bool = Field(
        ..., 
        description="True if using the DVL framework, False otherwise"
    )

class GenerateResponse(BaseModel):
    """
    What backend will send back: the Python code and a base64-encoded PNG.
    """
    code: str
    output_path: str
