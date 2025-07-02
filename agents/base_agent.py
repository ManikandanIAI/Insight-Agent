from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent
from typing import List, Optional, Dict, Any
from llm.model import get_llm, get_llm_alt


class BaseAgent:
    def __init__(
        self,
        tools: Optional[List] = None,
        system_prompt: Optional[str] = None,
        response_schema=None
    ):
        self.model = None
        self.model_alt = None
        self.tools = tools or []
        self.response_schema = response_schema
        self.system_prompt = system_prompt

    def format_input_prompt(self, state: Dict[str, Any]) -> str:
        raise NotImplementedError(
            "Subclasses must implement format_input_prompt")

    def format_system_prompt(self, state: Dict[str, Any]) -> str:
        raise NotImplementedError(
            "Subclasses must implement format_system_prompt")

    def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError("Subclasses must implement __call__")
