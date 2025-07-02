from .base_agent import BaseAgent
from agent_prompts.response_generator_agent import SYSTEM_PROMPT
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage
from .utils import get_context_messages_for_response
from llm.model import get_llm, get_llm_alt
from llm.config import ReportGenerationConfig

rgc = ReportGenerationConfig()


class ReportGenerationAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        self.model = get_llm(rgc.MODEL, rgc.TEMPERATURE, rgc.MAX_TOKENS)
        self.model_alt = get_llm_alt(rgc.ALT_MODEL, rgc.ALT_TEMPERATURE, rgc.ALT_MAX_TOKENS)
        self.system_prompt = SYSTEM_PROMPT

    def format_input_prompt(self, state: Dict[str, Any]) -> str:
        task = state['current_task']

        input_prompt = f"### Latest User Query: {state['user_query']}\n"

        input_prompt += f"### Task: {task['agent_task']}\n"
        input_prompt += f"### Instructions: {task['instructions']}\n"
        input_prompt += f"### Expected_output: {task['expected_output']}\n"
        input_prompt += f"\n{state['user_metadata']}\n"
        input_prompt += f"### {state['currency_rates']}\n"

        if task.get('required_context') and state.get('task_list'):
            context_messages = get_context_messages_for_response(task['required_context'], state['task_list'])
            input_prompt += f"- Use the following information as **Context** to answer the User Query: {context_messages}\n---\n\n"
        
        if state.get('previous_messages'):
            input_prompt += f"The Latest User Query may be based on the previous queries and their responses.\n"
            msg_hist = "\n".join([f"Query: {msg[0]}\nResponse: ```{msg[1]}```\n" for msg in state['previous_messages']])
            input_prompt += f"**Q&A Context**:\n\nHere is the list of messages from oldest to latest:\n{msg_hist}\n--- END of Q&A Context---\n\n"

        if state.get('initial_info'):
            input_prompt += f"- You can also use this data retrieved from Internal Database as context:\n{state['initial_info']}"

        return input_prompt

    def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        task = state['current_task'].copy()

        input_prompt = self.format_input_prompt(state)
        system_message = SystemMessage(content=self.system_prompt)
        human_message = HumanMessage(content=input_prompt)

        try:
            response = self.model.invoke(input=[system_message, human_message])
        except Exception as e:
            print(f"Falling back to alternate model: {str(e)}")
            try:
                response = self.model_alt.invoke(
                    input=[system_message, human_message])
            except Exception as e:
                print(f"Error occurred in fallback model: {str(e)}")
                raise e

        final_response = response.content.strip()

        return {
            "messages": [human_message, response],
            "final_response": final_response
        }
