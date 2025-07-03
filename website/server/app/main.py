from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import router
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(
    title="DVL - LLM Visualization API",
    docs_url="/",       # serve Swagger UI at "/"
    redoc_url=None,     # disable ReDoc 
    debug=True
)

# container path to the mounted volumes
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

# CORS for Angular dev server
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


# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from app.routes import router
# from fastapi.staticfiles import StaticFiles
# import os

# # app = FastAPI(title="LLM-to-Viz API")

# app = FastAPI(
#     # title="LLM-to-Viz API",
#     title="DVL - LLM Visualization API",
#     docs_url="/",      # serve Swagger UI at "/"
#     redoc_url=None,     # disable ReDoc 
#     debug=True
# )

# output_dir = os.path.join(os.getcwd(), "/data/output")
# os.makedirs(output_dir, exist_ok=True)

# app.mount(
#     "/static-output",
#     StaticFiles(directory=output_dir),
#     name="static-output"
# )

# # app.mount(
# #     "/static-output",
# #     StaticFiles(directory="/code/data/Visualizations"),
# #     name="static-output"
# # )


# # Allow Angular dev server (localhost:4200) to call this API during development
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:4200"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
# app.include_router(router)
# @app.get("/health")
# def health():
#     """Simple health-check endpoint."""
#     return {"status": "ok"}
