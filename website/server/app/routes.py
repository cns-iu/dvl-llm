import httpx
from fastapi import APIRouter, HTTPException
from app.models import GenerateRequest, GenerateResponse
from app.services.llm_client import get_plot_code
from app.services.code_runner import run_python
from app.services.llm_orchestrator import generate_and_execute

router = APIRouter(prefix="/api", tags=["generate"])

@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    try:
        
#         model_name="DeepSeek-R1",
#         execution_env="python",
#         library="plotly",
#         filename_prefix=f"test"
        result = generate_and_execute(provider="jetstream",model_name=req.model,execution_env=req.language,library=req.library,filename_prefix=f"test")
        code = result["code"]
        output_path = result["output_html_path"]
        # image_b64 = run_python(code)
        return GenerateResponse(code=code, output_path=output_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

# @router.post("/generate", response_model=GenerateResponse)
# async def generate(req: GenerateRequest):
#     try:
        
# #         model_name="DeepSeek-R1",
# #         execution_env="python",
# #         library="plotly",
# #         filename_prefix=f"test"
#         result = await generate_and_execute(provider="jetstream",model_name=req.model,execution_env=req.language,library=req.library,filename_prefix=f"test")
#         code = result["code"]
#         output_path = result["output_html_path"]
#         # image_b64 = run_python(code)
#         return GenerateResponse(code=code, output_path=output_path)
#     except Exception as exc:
#         raise HTTPException(status_code=500, detail=str(exc))

# @router.post("/generate", response_model=GenerateResponse)
# async def generate(req: GenerateRequest):
#     try:
#         code = await get_plot_code(req.model,req.language,req.library)
#         image_b64 = run_python(code)
#         return GenerateResponse(code=code, image_b64=image_b64)
#     except Exception as exc:
#         raise HTTPException(status_code=500, detail=str(exc))
    

# @router.post("/generate", response_model=GenerateResponse)
# async def generate(req: GenerateRequest):
#     try:
#         # 1. Generate code from LLM
#         code = await get_plot_code(req.model, req.language, req.library)

#         # 3. POST only the code to that runner
#         async with httpx.AsyncClient() as client:
#             response = await client.post(
#                 "http://127.0.0.1:8001/execute",
#                 json={"code": code}
#             )
#             response.raise_for_status()
#             payload = response.json()
#             image_b64 = payload.get("output")
#             if not image_b64:
#                 raise HTTPException(
#                     status_code=500,
#                     detail="Runner service did not return an 'output' field"
#                 )

#         # 4. Return both the code and the runner’s output
#         return GenerateResponse(code=code, image_b64=image_b64)

#     except httpx.HTTPStatusError as http_exc:
#         # Runner returns a 4xx/5xx
#         raise HTTPException(status_code=502, detail=f"Runner error: {http_exc.response.text}")
#     except HTTPException:
#         raise
#     except Exception as exc:
#         raise HTTPException(status_code=500, detail=str(exc))

# import httpx
# from fastapi import HTTPException

# @router.post("/generate", response_model=GenerateResponse)
# async def generate(req: GenerateRequest):
#     try:
#         # 1. Generate code from LLM
#         code = await get_plot_code(req.model, req.language, req.library)

#         # 2. Pick runner URL based on language
#         if req.language == "python":
#             runner_url = "http://python-runner:8001/execute"
#         elif req.language == "javascript":
#             runner_url = "http://js-runner:8002/execute"
#         elif req.language == "r":
#             runner_url = "http://r-runner:8003/execute"
#         else:
#             raise HTTPException(status_code=400, detail="Unsupported language")

#         # 3. POST only the code to that runner
#         async with httpx.AsyncClient() as client:
#             response = await client.post(
#                 runner_url,
#                 json={"code": code}
#             )
#             response.raise_for_status()
#             payload = response.json()
#             image_b64 = payload.get("output")
#             if not image_b64:
#                 raise HTTPException(
#                     status_code=500,
#                     detail="Runner service did not return an 'output' field"
#                 )

#         # 4. Return both the code and the runner’s output
#         return GenerateResponse(code=code, image_b64=image_b64)

#     except httpx.HTTPStatusError as http_exc:
#         # Runner returned a 4xx/5xx
#         raise HTTPException(status_code=502, detail=f"Runner error: {http_exc.response.text}")
#     except HTTPException:
#         raise
#     except Exception as exc:
#         raise HTTPException(status_code=500, detail=str(exc))