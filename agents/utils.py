from typing import List, Dict, Any, Literal
from langgraph.types import Command
from langgraph.graph import END
from langchain_core.messages import AIMessage, ToolMessage
from llm.model import get_llm, get_llm_alt
from schemas.structured_responses import RelatedQueries
import json


def get_context_messages(required_context: List[str], task_list: List[Dict[str, Any]]) -> List:
    context_messages = []
    required_tool_names = [
        'get_webpage_info', 'get_reddit_post_text_tool', 'db_search_tool', 'code_execution_tool']

    if required_context:
        for task_name in required_context:
            for subtask in task_list:
                if subtask['task_name'] == task_name:
                    for msg in subtask['task_messages']:
                        # if isinstance(msg, ToolMessage):
                        #     if msg.name in required_tool_names:
                        #         msg = AIMessage(content=msg.content)
                        #         context_messages.append(msg)
                        if isinstance(msg, AIMessage):
                            if msg.content and (not msg.tool_calls):
                                context_messages.append(msg)

    return context_messages


def get_context_messages_for_response(required_context: List[str], task_list: List[Dict[str, Any]]) -> List:
    context_messages = []
    required_tool_names = ['get_webpage_info', 'get_reddit_post_text_tool', 'db_search_tool']
    if required_context:
        for task_name in required_context:
            for subtask in task_list:
                if subtask['task_name'] == task_name:
                    if subtask.get('task_messages'):
                        for msg in subtask['task_messages']:
                            if subtask['agent_name'] == 'Coding Agent':
                                if isinstance(msg, ToolMessage):
                                    context_messages.append(
                                        "Response from generated code:\n\n" + msg.content)
                                if isinstance(msg, AIMessage):
                                    if msg.content and (not msg.tool_calls):
                                        context_messages.append(msg.content)
                                    elif msg.tool_calls:
                                        tool_msg = "Generated code:\n"
                                        for tool_call in msg.tool_calls:
                                            tool_msg += f"{tool_call['args']}\n"
                                        context_messages.append(tool_msg)
                            else:
                                # if isinstance(msg, ToolMessage):
                                #     if msg.name in required_tool_names:
                                #         context_messages.append(msg.content)
                                if isinstance(msg, AIMessage):
                                    if msg.content and (not msg.tool_calls):
                                        context_messages.append(msg.content)

    return "\n\n---\n\n".join(context_messages)


def task_router_node(state: Dict[str, Any]) -> Command[Literal["Web Search Agent", "Social Media Scrape Agent", "Finance Data Agent",
                                                               "Sentiment Analysis Agent", "Data Comparison Agent", "Coding Agent",
                                                               "Response Generator Agent", "__end__"]]:
    task_list = state['task_list'].copy()
    current_task = state.get('current_task')
    MAX_RETRIES = 2

    # if current_task:
    #     # Validate the current task using the new validation agent
    #     validation_output = task_validation(state)

    #     is_valid = validation_output.get("is_valid", "Incorrect Response")
    #     feedback = validation_output.get("feedback", "")

    #     # Initialize retry counter if not present.
    #     if "retry" not in current_task:
    #         current_task["retry"] = 0

    #     if is_valid == "Incorrect Response":
    #         # Store feedback and increment retry count.
    #         current_task["task_feedback"] = feedback
    #         current_task["retry"] += 1

    #         if current_task["retry"] < MAX_RETRIES:
    #             return Command(
    #                 goto=current_task["agent_name"],
    #                 update={
    #                     "current_task": current_task,
    #                     "task_list": task_list,
    #                 }
    #             )

    # If no current task or validation passed, select the next task
    if current_task is None:
        next_task = task_list[0]
    else:
        # Find the index of the current task
        current_task_index = next((index for index, task in enumerate(task_list) if task['task_name'] == current_task['task_name']), -1)
        task_list[current_task_index] = current_task
        # if current_task['task_name'] in state['research_plan']:
        #     task_id = current_task['task_name']
        #     current_plan = state['research_plan'].get('task_id')
        #     if current_plan:
        #         current_plan['complete'] = True
        #         print(f"\n{current_plan}\n")


        if current_task_index == len(task_list) - 1:
            return Command(
                goto=END,
                update={
                    'task_list': task_list
                }
            )

        next_task = task_list[current_task_index + 1]

    target_agent = next_task['agent_name']
    # if next_task['task_name'] in state['research_plan']:
    #     task_id = next_task['task_name']
    #     current_plan = state['research_plan'].get('task_id')
    #     if current_plan:
    #         current_plan['agent'] = target_agent


    return Command(
        goto=target_agent,
        update={
            'current_task': next_task,
            'task_list': task_list
        }
    )


def get_context_based_answer_prompt(context: str, query: str) -> str:
    prompt = (
        f"You are a helpful assistant. Your task is to answer the `User Query` based only on the given `Context`.\n",
        f"---\n",
        f"### Context:\n{context}\n",
        f"---\n",
        f"### User Query:\n{query}\n"
    )

    return "\n".join(prompt)


def get_related_queries_util(previous_messages: list) -> List[str]:
    # input = "The following are the user queries from previous interactions from oldest to latest:\n"
    input = '''You are given a list of user search queries from a past interaction. 
                Your job is to generate 5 related search queries that a user might search for next or that are semantically similar to the original ones.
                This is a list of
            '''
    for msg in previous_messages:
        input += f" User Query: {msg[0]}\n"

    input += '''### Guidelines to generate the related queries:
                1. All generated queries must be semantically related to the user’s intent or topic.
                2. Use a mix of query types:
                    - Question-based (e.g., “How to…”, “Why does…”, “What are…”)
                    - Keyword/phrase-based 
                    - Exploratory or comparative (e.g., “alternatives to X”, “X vs Y”)
                3. Use **natural, conversational, or web-search-like phrasing**.
                4. Keep the output concise, readable, and non-redundant.
                5. The queries should be diverse but **not stray outside the core theme** of the input queries.

                ### Output format:
                Return **exactly 4** related queries, formatted as a list with each query on a new line. 
                Do not explain or add extra commentary.
            '''

    try:
        model = get_llm(model_name="gpt-4o-mini", temperature=0.6)
        response = model.invoke(input=input, response_format=RelatedQueries)

    except Exception as e:
        print(f"Falling back to alternate model: {str(e)}")
        try:
            model = get_llm_alt("gemini/gemini-2.0-flash-lite", 0.6)
            response = model.invoke(input=input, response_format=RelatedQueries)
        except Exception as e:
            print(f"Error occurred in fallback model: {str(e)}")
            raise e

    if response.content:
        related_queries = json.loads(response.content)['related_queries']

        return related_queries
    return []


async def generate_session_title(content: str) -> str:
    print(f"\n\n----\nGenerating session title for content: {content}\n\n")
    input = f"""<Role>
You are a Conversation Title Generator Assistant. 
You are provided with context of a chat conversation, which may include greetings, questions and their responses.
Your task is to give a concise and short title to the conversation by following the `Instructions`.
</Role>

<Instructions>
1. If all the User Queries in the Conversation are greetings and the count is less than five then strictly repond with "New Chat" as the title.
2. If count of User Query only containing greetings is more than five then response with title appropriately reflecting the continuous greetings.
3. If the conversation is about a specific context or question other than greetings, generate a title that reflects the main topic discussed in the chat.
3. If the conversation starts with a greeting and then transition to a specific topic, generate a title that reflects the main topic discussed in the chat.
4. Keep the title length short and concise, i.e., 4-5 words, and avoid using special characters.
Example Response Titles: "Latest Tech Trends", "Healthy Eating Tips", "Traveling to Japan", "Python Programming Basics", "Water Conservation Essay", "Google Password Leak Alert".
5. If the conversation does not have any User Query or is empty, respond with "New Chat".
</Instructions>

<Conversation Context>
{content}
</Conversation Context>
"""
    try:
        model = get_llm(model_name = "gpt-4.1-nano", temperature = 0.4)
        response = await model.ainvoke(input=input)
        
    except Exception as e:
        print(f"Falling back to alternate model: {str(e)}")
        try:
            model = get_llm_alt("gemini/gemini-2.0-flash-lite", 0.4)
            response = await model.ainvoke(input=input)
        except Exception as e:
            print(f"Error occurred in fallback model: {str(e)}")
            raise e
    print(f"\n\n----\nGenerated session title: {response.content.strip()}")
    return response.content.strip() if response.content else "New Chat"

