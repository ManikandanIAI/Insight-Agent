from typing import Dict, Any, List, AsyncGenerator, Optional
import uuid
import queue
import janus
import threading
from insight_graph import InsightAgentGraph
from utils import get_date_time, format_langgraph_message, PRICING, get_user_metadata
from langgraph.graph.state import CompiledStateGraph
from langchain_core.messages import BaseMessage, AIMessage, HumanMessage, AIMessageChunk
import sys
import traceback
from agents.utils import get_related_queries_util
from tools.finance_data_tools import get_currency_exchange_rates
import time
import asyncio
import mongodb
from api_utils import check_stop_conversation


agent_graph_instance = InsightAgentGraph()


async def process_agent_input_functional(user_id: str, session_id: str, user_query: str, message_id: str, prev_message_id: str, realtime_info: bool, pro_reasoning: bool, retry_response: bool, timezone: str, ip_address:str, doc_ids: Optional[List[str]] = None) -> AsyncGenerator[Dict[str, Any], None]:
    start_time = time.monotonic()
    current_messages_log = []
    sources_for_message = []
    message_logs = ""
    query_metadata = {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0, 'token_cost': 0.0}
    final_response_content = "No response generated"
    stopTime = time.time()

    local_time = get_date_time(timezone)

    await mongodb.store_user_query(user_id, session_id, message_id, user_query, timezone, doc_ids)

    def store_current_message(msg_type: str, content: dict):
        enriched_content = content.copy()

        if 'created_at' not in enriched_content:
            enriched_content['created_at'] = local_time.isoformat()

        if 'response' in enriched_content or 'research-manager' in enriched_content:
            current_messages_log.append(enriched_content)

        if msg_type == 'agent_updates' and 'type' not in enriched_content:
            return

        if 'type' in enriched_content and enriched_content['type'].endswith('chunk'):
            return

        current_messages_log.append(enriched_content)


    def count_usage_metrics(token_usage):
        model = token_usage.get('model', 'gpt-4.1-mini')

        pricing = PRICING.get(model, PRICING["gpt-4.1-mini"])

        input_cost = pricing["input"] * token_usage.get("input_tokens", 0)
        output_cost = pricing["output"] * token_usage.get("output_tokens", 0)
        total_cost = input_cost + output_cost

        query_metadata["input_tokens"] += token_usage.get("input_tokens", 0)
        query_metadata["output_tokens"] += token_usage.get("output_tokens", 0)
        query_metadata["total_tokens"] += token_usage.get("total_tokens", 0)
        query_metadata["token_cost"] += total_cost



    yield {"start_stream": str(message_id)}
    # store_current_message("start_stream_event", {"message_id": message_id})
    config = {
        "configurable": {
            "thread_id": message_id},
        "recursion_limit": 50
    }

    retry_count = 0
    if retry_response:
        retry_count += 1

    previous_message_pairs = await mongodb.get_session_history_from_db(session_id, prev_message_id, limit=7)

    input_data = {
        "user_query": user_query,
        "file_path": None,
        "file_content": None,
        "user_metadata": await asyncio.to_thread(
            get_user_metadata,
            timezone,
            ip_address
        ),
        "realtime_info": realtime_info,
        "previous_messages": previous_message_pairs,
        "reasoning": pro_reasoning,
        "currency_rates": await asyncio.to_thread(
            get_currency_exchange_rates._run,
            currencies=['INR', 'AED', 'EUR'],
            explanation="NA"
        ),
        "doc_ids": doc_ids
    }
    store_current_message("human_input", input_data)
    message_logs += f"HUMAN INPUT\n{str(input_data)}\n\n"

    insight_agent_runnable = agent_graph_instance.get_graph()

    TOOL_CALLING_AGENTS = {"DB Search Agent", "Web Search Agent", "Finance Data Agent", "Coding Agent", "Social Media Scrape Agent"}
    is_completed = False
    try:

        com_queue = janus.Queue()

        def langchain_processor(com_queue : janus.Queue):
            for agent_id, stream_mode, update in insight_agent_runnable.stream(input_data, config, stream_mode=["updates", "messages"], subgraphs=True):
                com_queue.sync_q.put((agent_id, stream_mode, update))
            com_queue.sync_q.put((None, None, None))

        threading.Thread(target=langchain_processor,args=(com_queue,)).start()

        while True :
            agent_id, stream_mode, update = await com_queue.async_q.get()

            if (agent_id, stream_mode, update) == (None, None, None):
                break

            if stream_mode == 'updates':
                message_logs += f"AGENT UPDATE\n{str((agent_id, stream_mode, update))}\n\n"

            if stopTime + 3 < time.time():
                stop_processing = await check_stop_conversation(session_id, message_id)
                if stop_processing:
                    raise RuntimeError("User stopped query processing.")
                stopTime = time.time()

            if stream_mode == "updates" and not agent_id:
                update_key = list(update.keys())[0]
                if update_key in TOOL_CALLING_AGENTS:
                    continue

                if update_key == "Response Generator Agent" or (update_key == "Query Intent Detector" and 'final_response' in update.get('Query Intent Detector', {})):
                    is_completed = True

            msg_to_yield = await format_langgraph_message((agent_id, stream_mode, update))
            if msg_to_yield:
                message_logs += f"FORMATTED MESSAGE\n{str(msg_to_yield)}\n\n"

            if isinstance(msg_to_yield, dict):
                if 'token_usage' in msg_to_yield:
                    count_usage_metrics(msg_to_yield['token_usage'])
                else:
                    yield msg_to_yield

                    store_current_message("agent_updates", msg_to_yield)
                    if 'sources' in msg_to_yield:
                        sources_for_message.extend(msg_to_yield['sources'])

            elif isinstance(msg_to_yield, list):
                for m_item in msg_to_yield:
                    if 'token_usage' in m_item:
                        count_usage_metrics(m_item['token_usage'])
                    else:
                        yield m_item

                        store_current_message("agent_updates", m_item)
                        if 'sources' in m_item:
                            sources_for_message.extend(m_item['sources'])

        if is_completed:
            end_time = time.monotonic()
            duration_seconds = end_time - start_time
            time_event = {"time": f"{int(duration_seconds)} sec", "message_id": message_id, "in_seconds": int(duration_seconds)}

            if duration_seconds >= 60:
                minutes = int(duration_seconds // 60)
                remaining_seconds = int(duration_seconds % 60)
                time_event["time"] = f"{minutes} min {remaining_seconds} sec"
            yield time_event

            final_state = insight_agent_runnable.get_state(config=config).values
            final_response_state = final_state.get('final_response')

            if final_response_state:
                if hasattr(final_response_state, 'content'):
                    final_response_content = final_response_state.content
                else:
                    final_response_content = str(final_response_state)
            else:
                messages_list = final_state.get('messages', [])

                if messages_list and hasattr(messages_list[-1], 'content'):
                    final_response_content = messages_list[-1].content
                elif messages_list:
                    final_response_content = str(messages_list[-1])

            await mongodb.update_session_history_in_db(session_id, user_id, message_id, user_query, final_response_content, local_time, timezone)

            final_data_event = {'state': "completed_from_graph"}

            if final_state.get('is_relevant_query', False):
                related_queries = await asyncio.to_thread(get_related_queries_util, await mongodb.get_session_history_from_db(session_id, message_id, limit = 3))

                if related_queries:
                    final_data_event['related_queries'] = related_queries

            if sources_for_message:
                final_data_event['sources'] = sources_for_message
                store_current_message("sources", {'sources': sources_for_message})

            yield final_data_event

        yield {"store_data": {"messages": current_messages_log, 'logs': message_logs, 'metadata': query_metadata}}

    except Exception as e:
        error_msg = f"Error in agent processing: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        message_logs += f"ERROR MESSAGE\n{str(error_msg)}\n\n"
        error_event = {'error': error_msg}
        yield error_event

        if final_response_content == "No response generated":
            await mongodb.update_session_history_in_db(session_id, user_id, message_id, user_query, error_msg, local_time, timezone)

        store_current_message("error", error_event)
        yield {"store_data": {"messages": current_messages_log, 'logs': message_logs, 'metadata': query_metadata}}

    finally:
        pass
