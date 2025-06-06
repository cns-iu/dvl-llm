import os, httpx

OPENAI_KEY = os.getenv("OPENAI_API_KEY", "").strip()
ENDPOINT   = "https://api.openai.com/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are a Python plotting assistant. "
    "Return ONLY Python code that saves a PNG figure as 'out.png'. "
    "Do not add explanations or markdown."
)

HEADERS = {
    "Authorization": f"Bearer {OPENAI_KEY}",
    "Content-Type": "application/json",
}

async def get_plot_code(model: str, language: str, library: str) -> str:
    """
    • If OPENAI_API_KEY is **set**, calls the real API.
    • If the key is **missing/empty**, just echo the prompt back as code
    pass raw Python from the front-end while testing.
    """
    if not OPENAI_KEY:
        # Local dev mode
        print(" No API key found → echoing prompt as code")
        return library.strip()           

    # --- LLM call --- #
    body = {
        "model": model,
        "language":language,
        "library" :library,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": library,}
        ],
        "temperature": 0.4,
        "max_tokens": 800,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(ENDPOINT, headers=HEADERS, json=body)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip("`")



# import os, httpx, asyncio, json

# OPENAI_KEY = os.getenv("OPENAI_API_KEY")
# ENDPOINT = "https://api.openai.com/v1/chat/completions"

# SYSTEM_PROMPT = (
#     "You are a Python plotting assistant. "
#     "Return ONLY Python code that saves a PNG figure as 'out.png'. "
#     "Do not add explanations or markdown."
# )

# HEADERS = {
#     "Authorization": f"Bearer {OPENAI_KEY}",
#     "Content-Type": "application/json",
# }

# async def get_plot_code(prompt: str, model: str) -> str:
#     """Call OpenAI and return ONLY the Python code string."""
#     body = {
#         "model": model,
#         "messages": [
#             {"role": "system", "content": SYSTEM_PROMPT},
#             {"role": "user", "content": prompt},
#         ],
#         "temperature": 0.4,
#         "max_tokens": 800,
#     }

#     async with httpx.AsyncClient(timeout=60) as client:
#         r = await client.post(ENDPOINT, headers=HEADERS, json=body)
#         r.raise_for_status()
#         content = r.json()["choices"][0]["message"]["content"]
#         return content.strip("`")            # drop back-ticks if any
