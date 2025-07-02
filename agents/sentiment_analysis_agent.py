from .base_agent import BaseAgent
from agent_prompts.sentiment_analysis_agent import SYSTEM_PROMPT
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage
from .utils import get_context_messages
from llm.model import get_llm, get_llm_alt
from llm.config import SentimentAnalysisConfig

sac = SentimentAnalysisConfig()

class SentimentAnalysisAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        self.model = get_llm(sac.MODEL, sac.TEMPERATURE, sac.MAX_TOKENS)
        self.model_alt = get_llm_alt(sac.ALT_MODEL, sac.ALT_TEMPERATURE, sac.ALT_MAX_TOKENS)
        self.system_prompt = SYSTEM_PROMPT

    def format_input_prompt(self, state: Dict[str, Any]) -> str:
        task = state['current_task']

        input_prompt = f"""## Task Name: {task['task_name']}\n## Instruction: {task['instructions']}
## Expected Output: {task['expected_output']}\n{state['user_metadata']}\n"""

        if task.get('task_feedback'):
            input_prompt += f"""\n### Feedback from Previous Iteration:\n{task.get('task_feedback')}
### Note for This Iteration: Please improve the results based on the feedback provided above. 
Address any identified issues and enhance the overall quality of the output.\n"""

        return input_prompt

    def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        task = state['current_task'].copy()

        input_prompt = self.format_input_prompt(state)
        system_message = SystemMessage(content=self.system_prompt)
        human_message = HumanMessage(content=input_prompt)

        context_messages = []
        if task.get('required_context') and state.get('task_list'):
            context_messages = get_context_messages(
                task['required_context'], state['task_list'])

        try:
            response = self.model.invoke(
                input=[system_message] + context_messages + [human_message])
        except Exception as e:
            print(f"Falling back to alternate model: {str(e)}")
            try:
                response = self.model_alt.invoke(
                    input=[system_message] + context_messages + [human_message])
            except Exception as e:
                print(f"Error occurred in fallback model: {str(e)}")
                raise e

        task['task_messages'] = [human_message, response]

        return {
            "messages": [human_message, response],
            "current_task": task
        }
