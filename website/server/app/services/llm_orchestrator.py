# dvl_orchestrator.py

import requests
from .llm_factory import LLMFactory
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import re

def extract_code(raw_text: str) -> str:
    match = re.search(r"```(?:python)?\n(.*?)```", raw_text, re.DOTALL)
    return match.group(1).strip() if match else raw_text.strip()

def generate_and_execute(
    provider: str,
    model_name: str,
    execution_env: str,
    library: str,
    filename_prefix: str = "llm_generated_chart"
):
    # 1. Init LLM
    factory = LLMFactory(
        default_jetstream_api_key='sk-80c0448d6e224899a92668cc7e250c55',
        # default_openai_api_key='your_openai_key_here_if_needed'
        default_google_api_key=''
    )
    llm = factory.get_model(provider=provider, model_name=model_name, temperature=0)

    # 2. Build the prompt
    prompt_template = ChatPromptTemplate.from_messages([
        ("system", "You are a data visualization expert."),
        ("human",
         "Generate {execution_env} code **using the {library} library ONLY** to create a line chart comparing cumulative counts over time across different" 
        "biological groups with linear scale on y-axis and with legend for each group "
         "from the CSV file at /app/data/input/dvl-llm-1-hra-growth-over-time.csv. "
         "the csv looks like the following:"
         "group,date,count,order"
            "experts,2019-04-24,1,2"
            "experts,2019-07-30,1,2"
            "experts,2020-01-01,2,2"
            "experts,2021-03-12,32,2"
            "experts,2021-05-06,16,2"
            "experts,2021-07-28,1,2"
            "experts,2021-12-01,48,2"
            "experts,2021-12-15,2,2"
         "Save the output HTML to /app/data/output/{filename_prefix}.html. "
         "Assume that the input and output folders already exist — do not create them. "
         "Do not use the os library or any file/directory creation logic. "
         "**Return only raw executable code — do not wrap it in triple backticks or markdown.**")
    ])
    chain = prompt_template | llm | StrOutputParser()

    # 3. Get generated code
    prompt_vars = {
        "execution_env": execution_env,
        "library": library,
        "filename_prefix": filename_prefix
    }
    code = chain.invoke(prompt_vars)
    code = extract_code(code)
    print("\n--- Code from LLM ---\n")
    # print(code)

    # 4. Route to correct executor (only Python for now)
    if execution_env.lower() == "python":
        response = requests.post(
            # "http://localhost:5001/execute",
            "http://python-executor:5001/execute",
            json={"code": code, "filename_prefix": filename_prefix}
        )
    else:
        raise ValueError(f"Unsupported execution environment: {execution_env}")

    # 5. Return result
    return response.json()


# if __name__ == "__main__":
#     result = generate_and_execute(
#         provider="jetstream",
#         model_name="DeepSeek-R1",
#         execution_env="python",
#         library="plotly",
#         filename_prefix=f"test"
#     )

#     print("\n--- Final Execution Result ---\n")
#     print(result)