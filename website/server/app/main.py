from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routes import router

import os
import json
from pathlib import Path
import httpx

app = FastAPI(
    title="DVL - LLM Visualization API",
    docs_url="/",       # serve Swagger UI at "/"
    redoc_url=None,     # disable ReDoc
    debug=True
)

# -------------------------------------------------------------------
# Static output dirs (your existing setup)
# -------------------------------------------------------------------
output_dir = "/app/data/output"
os.makedirs(output_dir, exist_ok=True)

app.mount(
    "/static-output",
    StaticFiles(directory=output_dir),
    name="static-output"
)

sdata_output_dir = "/app/sdata/output"
os.makedirs(sdata_output_dir, exist_ok=True)

app.mount(
    "/sdata-output",
    StaticFiles(directory=sdata_output_dir),
    name="sdata-output"
)

# -------------------------------------------------------------------
# NEW: prompt config download + save locations
# -------------------------------------------------------------------
DATA_INPUT_DIR = Path("/app/data/input")
SDATA_PROMPTS_DIR = Path("/app/sdata/input/prompts")

# Ensure directories exist
DATA_INPUT_DIR.mkdir(parents=True, exist_ok=True)
SDATA_PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

# Paths where the JSON will be saved (and visible on the host via mounts)
PROMPTS_DATA_PATH = DATA_INPUT_DIR / "prompts_updated.json"
PROMPTS_SDATA_PATH = SDATA_PROMPTS_DIR / "prompts_updated.json"

# You can override this via env var in docker-compose if you like
PROMPTS_URL = "https://drive.usercontent.google.com/download?id=1Ij5sEgu4IPJnLKdmMoLTtxWUNwfWr_zE&export=download"

@app.on_event("startup")
async def fetch_and_save_prompts():
    """Fetch prompts_updated.json from GitHub and save it to both data and sdata."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(PROMPTS_URL, timeout=10)
            resp.raise_for_status()
            prompts = resp.json()

        # Save to /app/data/input/prompts_updated.json
        PROMPTS_DATA_PATH.write_text(json.dumps(prompts, indent=2))

        # Save to /app/sdata/input/prompts/prompts_updated.json
        PROMPTS_SDATA_PATH.write_text(json.dumps(prompts, indent=2))

        print(f"[startup] Prompts fetched and saved to:\n - {PROMPTS_DATA_PATH}\n - {PROMPTS_SDATA_PATH}")
    except Exception as e:
        # Decide if you want to fail hard or just warn
        print(f"[startup] Failed to fetch prompts from {PROMPTS_URL}: {e}")

# -------------------------------------------------------------------
# CORS + routes (existing)
# -------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/health")
def health():
    """Simple health-check endpoint."""
    return {"status": "ok"}