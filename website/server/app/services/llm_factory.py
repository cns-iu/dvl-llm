import os
import re  # For filtering
from typing import Optional, Any, Literal, Dict, List, AsyncIterator, Iterator

# Import init_chat_model.
# The canonical path is 'from langchain_core.language_models.chat_models import init_chat_model'
# or 'from langchain.chat_models.base import init_chat_model'.
# Using the path you provided:
from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage, AIMessageChunk
from langchain_core.outputs import ChatResult, ChatGeneration, ChatGenerationChunk
from langchain_core.callbacks import CallbackManagerForLLMRun, AsyncCallbackManagerForLLMRun


# --- Helper Function and Class for Filtering ---
def filter_think_tags(text: str) -> str:
    """
    Removes content enclosed in <think>...</think> tags from a string.
    """
    if not isinstance(text, str):  # Guard for cases where content might not be a string
        return text
    # The re.DOTALL flag makes '.' match newlines as well.
    # The '?' makes the '*' non-greedy.
    filtered_text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    return filtered_text.strip()


class FilteredChatModel(BaseChatModel):
    """
    A wrapper around a BaseChatModel that filters <think> tags from AIMessage content
    for non-streaming generation methods. Streaming methods pass chunks through and
    filtering should be applied to the fully assembled stream.
    """
    model: BaseChatModel

    def _generate(
            self,
            messages: List[BaseMessage],
            stop: Optional[List[str]] = None,
            run_manager: Optional[CallbackManagerForLLMRun] = None,
            **kwargs: Any,
    ) -> ChatResult:
        result = self.model._generate(messages, stop=stop, run_manager=run_manager, **kwargs)
        for generation in result.generations:
            if isinstance(generation.message, AIMessage) and isinstance(generation.message.content, str):
                generation.message.content = filter_think_tags(generation.message.content)
        return result

    async def _agenerate(
            self,
            messages: List[BaseMessage],
            stop: Optional[List[str]] = None,
            run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
            **kwargs: Any,
    ) -> ChatResult:
        result = await self.model._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs)
        for generation in result.generations:
            if isinstance(generation.message, AIMessage) and isinstance(generation.message.content, str):
                generation.message.content = filter_think_tags(generation.message.content)
        return result

    def _stream(
            self,
            messages: List[BaseMessage],
            stop: Optional[List[str]] = None,
            run_manager: Optional[CallbackManagerForLLMRun] = None,
            **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        """
        Streams chunks from the underlying model.
        Note: <think> tag filtering is NOT applied per chunk due to the complexity
        of tags potentially spanning multiple chunks. Filter the fully assembled stream.
        """
        yield from self.model._stream(messages, stop=stop, run_manager=run_manager, **kwargs)

    async def _astream(
            self,
            messages: List[BaseMessage],
            stop: Optional[List[str]] = None,
            run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
            **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        """
        Asynchronously streams chunks from the underlying model.
        Note: <think> tag filtering is NOT applied per chunk. Filter the fully assembled stream.
        """
        async for chunk in self.model._astream(messages, stop=stop, run_manager=run_manager, **kwargs):
            yield chunk

    @property
    def _llm_type(self) -> str:
        return f"filtered-{self.model._llm_type}"

    # Expose any other necessary methods or properties from the wrapped model if needed
    # For example, if the underlying model has specific token counting methods:
    # def get_num_tokens(self, text: str) -> int:
    #     if hasattr(self.model, "get_num_tokens"):
    #         return self.model.get_num_tokens(text) # type: ignore
    #     return super().get_num_tokens(text)


# --- LLMFactory Definition ---

# User-facing provider names
UserProviderType = Literal["google", "openai", "jetstream"]

# Provider names as expected by init_chat_model
InternalProviderMap: Dict[UserProviderType, str] = {
    "google": "google_genai",  # For ChatGoogleGenerativeAI
    "openai": "openai",  # For ChatOpenAI
    "jetstream": "openai",  # JetStream uses an OpenAI-compatible interface
}

DEFAULT_JETSTREAM_BASE_URL = "https://llm.jetstream-cloud.org/api/"


class LLMConnectorError(Exception):
    """Custom exception for LLMFactory errors."""
    pass


class LLMFactory:
    def __init__(
            self,
            default_google_api_key: Optional[str] = None,
            default_openai_api_key: Optional[str] = None,
            default_jetstream_api_key: Optional[str] = None,
            default_jetstream_base_url: Optional[str] = None,
    ):
        self.google_api_key = default_google_api_key or os.getenv("GOOGLE_API_KEY")
        self.openai_api_key = default_openai_api_key or os.getenv("OPENAI_API_KEY")
        self.jetstream_api_key = (
                default_jetstream_api_key
                or os.getenv("JETSTREAM_API_KEY")
                or self.openai_api_key
        )
        self.jetstream_base_url = (
                default_jetstream_base_url
                or os.getenv("JETSTREAM_API_BASE")
                or DEFAULT_JETSTREAM_BASE_URL
        )

    def get_model(
            self,
            provider: UserProviderType,
            model_name: str,
            api_key_override: Optional[str] = None,
            jetstream_base_url_override: Optional[str] = None,
            **kwargs: Any,
    ) -> BaseChatModel:
        user_provider_lower = provider.lower()

        if user_provider_lower not in InternalProviderMap:
            raise LLMConnectorError(
                f"Unsupported provider: '{provider}'. Supported: {', '.join(InternalProviderMap.keys())}."
            )

        # Use 'provider' as the argument name for init_chat_model, as per current Langchain docs.
        # If your environment uses 'model_provider', you might need to adjust this.
        internal_provider_name_for_init = InternalProviderMap[user_provider_lower]  # type: ignore

        model_constructor_kwargs = kwargs.copy()

        if user_provider_lower == "google":
            current_api_key = api_key_override or self.google_api_key
            if not current_api_key:
                raise LLMConnectorError("Google API key not set.")
            model_constructor_kwargs["google_api_key"] = current_api_key

        elif user_provider_lower == "openai":
            current_api_key = api_key_override or self.openai_api_key
            if not current_api_key:
                raise LLMConnectorError("OpenAI API key not set.")
            model_constructor_kwargs["openai_api_key"] = current_api_key

        elif user_provider_lower == "jetstream":
            current_api_key = api_key_override or self.jetstream_api_key
            if not current_api_key:
                raise LLMConnectorError("JetStream API key not set.")
            model_constructor_kwargs["openai_api_key"] = current_api_key

            current_base_url = jetstream_base_url_override or self.jetstream_base_url
            model_constructor_kwargs["openai_api_base"] = current_base_url

        try:
            # Note: Using 'provider' argument name for init_chat_model.
            # Your working example used 'model_provider'. If this causes an error,
            # you may need to change 'provider' back to 'model_provider' below,
            # or ensure your Langchain version and import path for init_chat_model align.
            base_chat_model = init_chat_model(
                model=model_name,
                model_provider=internal_provider_name_for_init,  # Key argument for init_chat_model
                **model_constructor_kwargs,
            )

            if user_provider_lower == "jetstream":
                # Wrap the JetStream model to filter its output
                return FilteredChatModel(model=base_chat_model)
            else:
                return base_chat_model

        except ImportError as ie:
            raise LLMConnectorError(
                f"ImportError for provider '{internal_provider_name_for_init}': {ie}. Ensure packages like langchain-openai, langchain-google-genai are installed."
            )
        except TypeError as te:  # To catch issues like unexpected keyword arguments
            raise LLMConnectorError(
                f"TypeError during model initialization for '{model_name}' with provider '{internal_provider_name_for_init}': {te}. Check arguments for init_chat_model."
            )
        except Exception as e:
            raise LLMConnectorError(
                f"Failed to initialize model '{model_name}' for provider '{provider}': {e}"
            )


# --- Example Usage (typically in a different file or a main script section) ---
if __name__ == "__main__":
    # Set Environment Variables before running (example):
    # export JETSTREAM_API_KEY="sk-ffb6c536e10d40dc902f28e93159a039"
    # export GOOGLE_API_KEY="your_google_key"
    # export OPENAI_API_KEY="your_openai_key"
    #
    # from langchain_core.messages import HumanMessage
    # from langchain_core.prompts import ChatPromptTemplate
    # from langchain_core.output_parsers import StrOutputParser
    #
    # print("--- Testing LLMFactory ---")
    #
    # # Instantiate the factory.
    # # Pass your JetStream key here if not set as an environment variable,
    # # or if you want to override the environment variable.
    # factory = LLMFactory(
    #     default_jetstream_api_key='',
    #     # default_openai_api_key='your_openai_key_here_if_needed'
    #     default_google_api_key=''
    # )
    #
    # test_configs = [
    #     # {
    #     #     "provider": "jetstream",
    #     #     "model_name": "llama-4-scout",
    #     #     "prompt": "What are the main benefits of using LangChain?",
    #     #     # Prompt to encourage the model
    #     #     "api_key_env_check": "JETSTREAM_API_KEY"
    #     # },
    #     # Add other providers if keys are set
    #     # {
    #     #     "provider": "openai",
    #     #     "model_name": "gpt-3.5-turbo",
    #     #     "prompt": "Explain quantum entanglement simply.",
    #     #     "api_key_env_check": "OPENAI_API_KEY"
    #     # },
    #     {
    #         "provider": "google",
    #         "model_name": "gemini-2.5-flash-preview-05-20",
    #         "prompt": "Explain quantum entanglement simply."
    #     },
    # ]
    #
    # for config in test_configs:
    #     print(f"\n--- Testing Provider: {config['provider']}, Model: {config['model_name']} ---")
    #
    #     key_to_check = config.get("api_key_env_check")
    #     provider_name = config["provider"]
    #
    #     # Check if key is available (via constructor default or env var)
    #     key_available = False
    #     if provider_name == "jetstream":
    #         key_available = bool(factory.jetstream_api_key)
    #     elif provider_name == "openai":
    #         key_available = bool(factory.openai_api_key)
    #     elif provider_name == "google":
    #         key_available = bool(factory.google_api_key)
    #
    #     if not key_available:
    #         print(
    #             f"Skipping {config['provider']}: API key not found (checked factory defaults & env var: {key_to_check}).")
    #         continue
    #
    #     try:
    #         llm = factory.get_model(
    #             provider=config["provider"],  # type: ignore
    #             model_name=config["model_name"],
    #             temperature=0,
    #         )
    #         print(f"Successfully initialized model: {type(llm)}")
    #         if isinstance(llm, FilteredChatModel):
    #             print(f"   (Wrapped model type: {type(llm.model)})")
    #
    #         # Test with invoke (which uses _generate)
    #         print(f"\nTesting with invoke using prompt: '{config['prompt']}'")
    #
    #         # Method 1: Direct invoke and access content (common for simple use)
    #         # ai_message_response = llm.invoke([HumanMessage(content=config["prompt"])])
    #         # filtered_content = ai_message_response.content
    #         # print("\nResponse Content (from AIMessage.content, should be filtered for JetStream):")
    #         # print(filtered_content)
    #
    #         # Method 2: Using LCEL with StrOutputParser
    #         prompt_template = ChatPromptTemplate.from_messages([("human", "{user_prompt}")])
    #         output_parser = StrOutputParser()
    #         chain = prompt_template | llm | output_parser
    #
    #         lcel_response_content = chain.invoke({"user_prompt": config["prompt"]})
    #         print("\nResponse Content (from LCEL chain with StrOutputParser, no <think> block should be present):")
    #         print(lcel_response_content)
    #
    #         print("--------------------")
    #
    #     except LLMConnectorError as e:
    #         print(f"LLMFactory Error: {e}")
    #     except Exception as e:
    #         print(f"An unexpected error occurred during test: {e}")
    pass