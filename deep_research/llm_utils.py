from .logging_utils import log_function
class ResearchConfig:
    """Configuration for the research assistant."""
    LLM_MODEL = "gpt-4o-mini"
    TEMPERATURE = 0.7

@log_function
def get_llm(model_name: str, temperature: float = None, max_tokens: int = None):
    from langchain_community.chat_models import ChatLiteLLM
    model = ChatLiteLLM(model=ResearchConfig.LLM_MODEL, temperature=temperature, max_tokens=max_tokens)
    return model