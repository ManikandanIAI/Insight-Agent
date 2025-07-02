from .base_agent import BaseAgent
from schemas.structured_responses import PlannerAgentOutput, TasksContainer
from pydantic import ValidationError
from agent_prompts.planner_agent import SYSTEM_PROMPT
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage
import json
import re
from llm.model import get_llm, get_llm_alt
from llm.config import PlannerConfig

pac = PlannerConfig()

class PlannerAgent(BaseAgent):
    def __init__(self):
        super().__init__()
        self.model = get_llm(pac.MODEL, pac.TEMPERATURE)
        self.model_alt = get_llm_alt(pac.ALT_MODEL, pac.ALT_TEMPERATURE)
        self.response_schema = PlannerAgentOutput
        self.system_prompt = SYSTEM_PROMPT

    def format_input_prompt(self, state: Dict[str, Any]) -> str:
        input_prompt = f"This is not the first time you are doing this task, so break down the latest user query into subtasks.\n"
        input_prompt += f"### Latest User Query: {state['user_query']}\n\n"
        input_prompt += f"\n{state['user_metadata']}\n"

        # if state.get('previous_messages'):
        #     input_prompt += f"The Latest User Query may be based on the previous queries and their responses. So use these Q&A as context to generate latest tasks.\n"
        #     msg_hist = "\n".join([f"Query: {msg[0]}\nResponse: ```{msg[1]}```\n" for msg in state['previous_messages']])
        #     input_prompt += f"**Q&A Context**:\n\nHere is the list of messages from oldest to latest:\n{msg_hist}\n--- END of Q&A Context---\n\n"


        if state.get('initial_info'):
            input_prompt += f"The following is the information obtained from Internal DB:\n{state['initial_info']}\n\nYou have to generate tasks to obtain only the remaining information.\n\n"

        if state.get('validation_result'):
            input_prompt += f"- Feedback from Previous Attempt: {state['validation_result']['feedback']}\n"

            if state.get('subtasks'):
                input_prompt += f"- This is the previously generated subtasks: {state['subtasks']}\n"

        # input_prompt += f"- {state['currency_rates']}\n"
        # print(input_prompt)
        return input_prompt
    
    def extract_thinking_and_json(self, response_content):
        # Extract content between <think> tags
        think_match = re.search(r'<think>(.*?)</think>', response_content, re.DOTALL)
        thinking_process = think_match.group(1).strip() if think_match else "No thinking process found"
        
        # Remove the thinking section from the response to avoid matching JSON inside it
        response_without_thinking = re.sub(r'<think>.*?</think>', '', response_content, flags=re.DOTALL)
        
        # Extract JSON content from the remaining response
        json_match = re.search(r'```json\s*(.*?)\s*```', response_without_thinking, re.DOTALL)
        json_content = json_match.group(1).strip() if json_match else None

        # Try to parse the JSON
        json_dict = None
        if json_content:
            try:
                json_dict = json.loads(json_content)
            except json.JSONDecodeError as e:
                print(f"JSON parsing error: {str(e)}")
                print("Raw JSON content:")
                print(json_content)

        return thinking_process, json_dict

    def __call__(self, state: Dict[str, Any]) -> Dict[str, Any]:
        input_prompt = self.format_input_prompt(state)
        system_message = SystemMessage(content=self.system_prompt)
        human_message = HumanMessage(content=input_prompt)

        try:
            response = self.model.invoke(input=[system_message, human_message])
        except Exception as e:
            print(f"Falling back to alternate model: {str(e)}")
            try:
                response = self.model_alt.invoke(input=[system_message, human_message])
            except Exception as e:
                print(f"Error occurred in fallback model: {str(e)}")
                raise e
            
        print("========\n", response.content, "\n++++++++")
        thinking, task_json = self.extract_thinking_and_json(response.content)
        print(thinking)


        # 2. Validate + parse using Pydantic
        # validated_tasks = None
        # try:
        #     # Wrap the raw dict under the "tasks" key, matching the Pydantic schema
        #     container = TasksContainer(tasks=task_json)
        #     validated_tasks = container.tasks
        #     # print(type(validated_tasks))
        #     # print(validated_tasks)
        #     test_json =  {task_id: task.model_dump() for task_id, task in validated_tasks.items()}
        #     print(type(test_json))
        # except ValidationError as e:
        #     # If the JSON is malformed or missing required fields, Pydantic throws a ValidationError
        #     print("Validation failed:", e)
        #     # You can choose to re-raise or handle/log the error here
        #     raise
        # print(type(task_json))
        # print(task_json)
        # subtasks = json.loads(response.content)

        return {
            # "subtasks": subtasks['subtasks'],
            "research_plan": task_json,
            "messages": [human_message, response],
        }
