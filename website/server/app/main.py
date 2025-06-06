from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import router

# app = FastAPI(title="LLM-to-Viz API")

app = FastAPI(
    title="LLM-to-Viz API",
    docs_url="/",      # serve Swagger UI at "/"
    redoc_url=None     # disable ReDoc 
)

# Allow Angular dev server (localhost:4200) to call this API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
@app.get("/health")
def health():
    """Simple health-check endpoint."""
    return {"status": "ok"}
