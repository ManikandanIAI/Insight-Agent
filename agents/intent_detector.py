from .base_agent import BaseAgent
from schemas.structured_responses import IntentDetection
from agent_prompts.intent_detector import SYSTEM_PROMPT
from typing import Dict, Any, Literal
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.types import Command
from langgraph.graph import END
import json
from llm.model import get_llm, get_llm_alt
from llm.config import IntentDetectionConfig

cfg = IntentDetectionConfig()


class IntentDetector(BaseAgent):
    def __init__(self):
        super().__init__()
        self.model = get_llm(cfg.MODEL, cfg.TEMPERATURE)
        self.model_alt = get_llm_alt(cfg.ALT_MODEL, cfg.ALT_TEMPERATURE)
        self.response_schema = IntentDetection
        self.system_prompt = SYSTEM_PROMPT

    def format_input_prompt(self, state: Dict[str, Any]) -> str:
        input_prompt = ""
        history = []

        input_prompt += f"### Latest User Query: {state['user_query']}\n"
        if 'doc_ids' in state:
            input_prompt += f"### Document IDs: {state['doc_ids']}\n\n"
        if state.get('file_path'):
            input_prompt += f"### File Path: {state['file_path']}\n"

        if state.get('file_content'):
            input_prompt += f"### File Content: {state['file_content']}\n"

        input_prompt += f"\n{state['user_metadata']}\n\n"

        if state.get('previous_messages'):
            for msg in state['previous_messages'] :
                history.append(HumanMessage(content=msg[0]))
                history.append(AIMessage(content=msg[1]))

        # input_prompt += f"### {state['currency_rates']}\n"
        print("Input prompt :", __name__, " : ", input_prompt)
        history.append(HumanMessage(content=input_prompt))
        return history

    def __call__(self, state: Dict[str, Any]) -> Command[Literal["Manager Agent", "Planner Agent", "DB Search Agent", "__end__"]]:
        history = self.format_input_prompt(state)
        messages = [SystemMessage(content=self.system_prompt)] + history

        try:
            output = self.model.invoke(input=messages, response_format=self.response_schema)
        except Exception as e:
            print(f"Falling back to alternate model: {str(e)}")
            try:
                output = self.model_alt.invoke(input=messages, response_format=self.response_schema)
            except Exception as e:
                print(f"Error occurred in fallback model: {str(e)}")
                raise e

        response = json.loads(output.content)

        if not response.get('reject_query', False):
            if not response.get('response_to_user'):
                if not state.get('realtime_info') and (response.get('query_intent') and any(intent in response.get('query_intent') for intent in ('historical', 'factual'))):
                    return Command(
                        goto="DB Search Agent",
                        update={
                            "messages": output,
                            "query_tag": response.get('query_tag'),
                            "is_relevant_query": True
                        }
                    )
                    
                else:
                    if state['reasoning']:
                        agent_name = "Manager Agent"
                    else:
                        agent_name = "Planner Agent"
                        
                    return Command(
                        goto=agent_name,
                        update={
                            "messages": output,
                            "query_tag": response.get('query_tag'),
                            "is_relevant_query": True
                        }
                    )

            else:
                return Command(
                    goto=END,
                    update={
                        "messages": output,
                        "is_relevant_query": True,
                        "final_response": response.get("response_to_user", "No response provided.")
                    }
                )
        else:
            return Command(
                goto=END,
                update={
                    "messages": output,
                    "is_relevant_query": False,
                    "final_response": response.get("response_to_user", "Please provide more information.")
                }
            )
