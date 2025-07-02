from langchain_community.chat_models import ChatLiteLLM
from langchain_openai import ChatOpenAI
from dotenv import dotenv_values
from typing import List, Optional, Any
import os


# os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
# os.environ["GEMINI_API_KEY"] = os.getenv("GEMINI_API_KEY")
# os.environ['GROQ_API_KEY'] = os.getenv("GROQ_API_KEY")
os.environ["LITELLM_LOG"] = "ERROR"

env_vars = dotenv_values('.env')
openai_api_key = env_vars.get('OPENAI_API_KEY')
gemini_api_key = env_vars.get('GEMINI_API_KEY')
groq_api_key = env_vars.get('GROQ_API_KEY')

if openai_api_key and not os.getenv("OPENAI_API_KEY"):
    print('getting api key from env')
    os.environ["OPENAI_API_KEY"] = openai_api_key
if gemini_api_key and not os.getenv("GEMINI_API_KEY"):
    print('getting api key from env')
    os.environ["GEMINI_API_KEY"] = gemini_api_key
if groq_api_key and not os.getenv("GROQ_API_KEY"):
    print('getting api key from env')
    os.environ["GROQ_API_KEY"] = groq_api_key


def get_llm(model_name: str, temperature: float = None, max_tokens: int = None):
    model = ChatLiteLLM(model=model_name, temperature=temperature, max_tokens=max_tokens, max_retries=2)
    return model


def get_llm_groq(model_name: str , temperature: float = None, top_p: float = None, top_k: int = None) -> ChatLiteLLM:
    return ChatLiteLLM(model=model_name, temperature=temperature, top_p=top_p, top_k=top_k)


def get_llm_alt(model_name: str, temperature: float = None, max_tokens: int = None):
    model = ChatLiteLLM(model= model_name, temperature=temperature, max_tokens=max_tokens)
    return model


def get_reasoning(model_name: str):
    model = ChatOpenAI(model=model_name)
    return model
