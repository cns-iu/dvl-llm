import os
import re
from typing import Optional, Any, Literal, Dict, List, AsyncIterator, Iterator

from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage, AIMessageChunk
from langchain_core.outputs import ChatResult, ChatGeneration, ChatGenerationChunk
from langchain_core.callbacks import CallbackManagerForLLMRun, AsyncCallbackManagerForLLMRun

# --- Helper Function and Filtering Wrapper ---

def filter_think_tags(text: str) -> str:
    if not isinstance(text, str):
        return text
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

class FilteredChatModel(BaseChatModel):
    model: BaseChatModel

    def _generate(self, messages: List[BaseMessage], stop: Optional[List[str]] = None,
                  run_manager: Optional[CallbackManagerForLLMRun] = None, **kwargs: Any) -> ChatResult:
        result = self.model._generate(messages, stop=stop, run_manager=run_manager, **kwargs)
        for generation in result.generations:
            if isinstance(generation.message, AIMessage) and isinstance(generation.message.content, str):
                generation.message.content = filter_think_tags(generation.message.content)
        return result

    async def _agenerate(self, messages: List[BaseMessage], stop: Optional[List[str]] = None,
                         run_manager: Optional[AsyncCallbackManagerForLLMRun] = None, **kwargs: Any) -> ChatResult:
        result = await self.model._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs)
        for generation in result.generations:
            if isinstance(generation.message, AIMessage) and isinstance(generation.message.content, str):
                generation.message.content = filter_think_tags(generation.message.content)
        return result

    def _stream(self, messages: List[BaseMessage], stop: Optional[List[str]] = None,
                run_manager: Optional[CallbackManagerForLLMRun] = None, **kwargs: Any) -> Iterator[ChatGenerationChunk]:
        yield from self.model._stream(messages, stop=stop, run_manager=run_manager, **kwargs)

    async def _astream(self, messages: List[BaseMessage], stop: Optional[List[str]] = None,
                       run_manager: Optional[AsyncCallbackManagerForLLMRun] = None, **kwargs: Any) -> AsyncIterator[ChatGenerationChunk]:
        async for chunk in self.model._astream(messages, stop=stop, run_manager=run_manager, **kwargs):
            yield chunk

    @property
    def _llm_type(self) -> str:
        return f"filtered-{self.model._llm_type}"


# --- Factory Using __new__ ---

UserProviderType = Literal["google", "openai", "jetstream"]
InternalProviderMap: Dict[UserProviderType, str] = {
    "google": "google_genai",
    "openai": "openai",
    "jetstream": "openai",
}

DEFAULT_JETSTREAM_BASE_URL = "https://llm.jetstream-cloud.org/api/"

class LLMConnectorError(Exception):
    pass

class LLMFactory:
    def __new__(
            cls,
            provider: UserProviderType,
            model_name: str,
            default_google_api_key: Optional[str] = None,
            default_openai_api_key: Optional[str] = None,
            default_jetstream_api_key: Optional[str] = None,
            default_jetstream_base_url: Optional[str] = None,
            api_key_override: Optional[str] = None,
            jetstream_base_url_override: Optional[str] = None,
            **kwargs: Any,
    ) -> BaseChatModel:

        google_api_key = default_google_api_key or os.getenv("GOOGLE_API_KEY")
        openai_api_key = default_openai_api_key or os.getenv("OPENAI_API_KEY")
        jetstream_api_key = default_jetstream_api_key or os.getenv("JETSTREAM_API_KEY") or openai_api_key
        jetstream_base_url = default_jetstream_base_url or os.getenv("JETSTREAM_API_BASE") or DEFAULT_JETSTREAM_BASE_URL

        provider_lower = provider.lower()
        if provider_lower not in InternalProviderMap:
            raise LLMConnectorError(
                f"Unsupported provider: '{provider}'. Supported: {', '.join(InternalProviderMap.keys())}."
            )

        model_provider = InternalProviderMap[provider_lower]
        model_args = kwargs.copy()

        try:
            if provider_lower == "google":
                key = api_key_override or google_api_key
                if not key:
                    raise LLMConnectorError("Google API key not set.")
                model_args["google_api_key"] = key

            elif provider_lower == "openai":
                key = api_key_override or openai_api_key
                if not key:
                    raise LLMConnectorError("OpenAI API key not set.")
                model_args["openai_api_key"] = key

            elif provider_lower == "jetstream":
                key = api_key_override or jetstream_api_key
                if not key:
                    raise LLMConnectorError("Jetstream API key not set.")
                base_url = jetstream_base_url_override or jetstream_base_url
                model_args["openai_api_key"] = key
                model_args["openai_api_base"] = base_url

            model = init_chat_model(
                model=model_name,
                model_provider=model_provider,
                **model_args,
            )

            if provider_lower == "jetstream":
                return FilteredChatModel(model=model)

            return model

        except ImportError as ie:
            raise LLMConnectorError(
                f"Missing provider package for '{provider}': {ie}"
            )
        except TypeError as te:
            raise LLMConnectorError(
                f"TypeError initializing model '{model_name}' for provider '{provider}': {te}"
            )
        except Exception as e:
            raise LLMConnectorError(
                f"Error initializing model '{model_name}' for provider '{provider}': {e}"
            )

if __name__ == "__main__":
    llm = LLMFactory(
        provider="jetstream",
        model_name="DeepSeek-R1",
        default_jetstream_api_key="sk-ffb6c536e10d40dc902f28e93159a039",
        temperature=0
    )
    response = llm.invoke(["Tell me about LangChain"])
    print(response.content)