from .base_agent import BaseAgent
from schemas.structured_responses import DBSearchOutput
from tools.internal_db_tools import  search_qdrant_tool
from agent_prompts.db_search_agent import SYSTEM_PROMPT
from typing import Dict, Any, Literal
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent
from .utils import get_context_based_answer_prompt, get_context_messages
from langgraph.types import Command
from llm.model import get_llm, get_llm_alt
from llm.config import DBSearchConfig

dbc = DBSearchConfig()


class DBSearchAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        self.model = get_llm(dbc.MODEL, dbc.TEMPERATURE)
        self.model_alt = get_llm_alt(dbc.ALT_MODEL, dbc.ALT_TEMPERATURE)
        self.tools = [search_qdrant_tool]
        self.response_schema = DBSearchOutput
        self.system_prompt = SYSTEM_PROMPT

    def format_input_prompt(self, state: Dict[str, Any]) -> str:
        input_prompt = f"### User Query: {state['user_query']}\n"
        input_prompt += f"\n{state['user_metadata']}\n\n"
        if 'doc_ids' in state:
            input_prompt += f"### Document IDs: {state['doc_ids']}\n\n"
        return input_prompt

    def __call__(self, state: Dict[str, Any]) -> Command[Literal["Planner Agent", "Manager Agent", "Validation Agent"]]:
        input_prompt = self.format_input_prompt(state)
        system_message = SystemMessage(content=self.system_prompt)
        human_message = HumanMessage(content=input_prompt)
        task = state['current_task'].copy()
        
        context_messages = []
        if task.get('required_context') and state.get('task_list'):
            context_messages = get_context_messages(
                task['required_context'], state['task_list'])
        
        input = {"messages": context_messages + [human_message]}
        try:
            agent = create_react_agent(model=self.model, tools=self.tools,
                                       response_format=self.response_schema, prompt=system_message)
            communication_log = agent.invoke(input)

        except Exception as e:
            print(f"Falling back to alternate model: {str(e)}")
            try:
                agent = create_react_agent(model=self.model_alt, tools=self.tools,
                                           response_format=self.response_schema, prompt=system_message)
                communication_log = agent.invoke(input)

            except Exception as e:
                print(f"Error occurred in fallback model: {str(e)}")
                raise e

        message_history = communication_log['messages']
        response = communication_log["structured_response"]
        filtered_message_history = [
            msg for msg in message_history if msg not in context_messages]
        task['task_messages'] = filtered_message_history
        # if response.is_sufficient_info:
            # input = get_context_based_answer_prompt(
            #     response.key_details_from_info, state['user_query'])
            # output = self.model.invoke(input)
        agent_name = "Task Router"
        if state['reasoning']:
            agent_name = "Manager Agent"

        return Command(
            goto=agent_name,
            update={
                "messages": message_history,
                "current_task": task
            }
        )
        # else:
        #     if state['reasoning']:
        #         agent_name = "Manager Agent"
        #     else:
        #         agent_name = "Planner Agent"
                
        #     return Command(
        #         goto=agent_name,
        #         update={
        #             "messages": message_history,
        #             "initial_info": response.key_details_from_info
        #         }
        #     )
