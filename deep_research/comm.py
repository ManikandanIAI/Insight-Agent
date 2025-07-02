from typing import Optional, Dict, Any, List, AsyncGenerator
import uuid
import traceback
import queue
import threading
import re
from deep_research.search_utils import tavily_search, generate_searchable_queries_from_topic_structure, store_extracted_content, urls_extractor, tag_matching, process_query_initial_stream, process_query_final
from deep_research.report_utils import generate_topic_structure, generate_topic_report, generate_final_report
from utils import get_unique_response_id, get_date_time, get_second_level_domain
import asyncio
import mongodb
import time
import markdown
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration
from utils import get_date_time, PRICING, get_user_metadata


async def send_tokens(s, group_size=5):
    for i in range(0, len(s), group_size):
        yield s[i:i+group_size]
        await asyncio.sleep(0)  # Yield control to the event loop


async def process_research_query_functional(user_id: str, session_id: str, user_query: str, message_id: str, timezone: str, prev_message_id: str = None) -> AsyncGenerator[Dict[str, Any], None]:
    try:
        start_time = time.monotonic()
        current_messages_log = []
        sources_for_message = []
        query_metadata = {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0, 'token_cost': 0.0}
        message_logs = f"HUMAN INPUT\n{user_query}, {prev_message_id}\n\n"
        markdown_text = None
        previous_state = None
        
        local_time = get_date_time(timezone)

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
        

        def store_research_message(content: dict):
            enriched_content = content.copy()
            if 'created_at' not in enriched_content:
                enriched_content['created_at'] = local_time.isoformat()
            
            if 'response' in enriched_content or 'research-manager' in enriched_content:
                current_messages_log.append(enriched_content)
            
            if ('type' in enriched_content and enriched_content['type'].endswith('chunk')) or 'usage' in enriched_content:
                return

            current_messages_log.append(enriched_content)

        await mongodb.store_user_query(user_id, session_id, message_id, user_query, timezone)
        store_research_message({'user_query': user_query})

        if prev_message_id:
            previous_state = await mongodb.get_previous_deep_research_state(session_id, prev_message_id)
            message_logs += f"previous_state\n{str(previous_state)}\n\n"
        else:
            previous_state = False

        if not previous_state:
            full_content = ""
            pqi_iter = process_query_initial_stream(user_query)

            async for update in pqi_iter:
                store_research_message(update)
                if "type" in update:
                    yield update  # pass all stream updates to frontend

                if "usage" in update:
                    count_usage_metrics(update['usage'])

                if "response" in update: # checks if update is the final full response
                    full_content = update["response"]

            message_logs += f"process_query_initial\n{str(full_content)}\n\n"

            end_time = time.monotonic()
            duration_seconds = end_time - start_time
            time_event = {"time": f"{int(duration_seconds)} sec", "message_id": message_id, "in_seconds": int(duration_seconds)}

            if duration_seconds >= 60:
                minutes = int(duration_seconds // 60)
                remaining_seconds = int(duration_seconds % 60)
                time_event["time"] = f"{minutes} min {remaining_seconds} sec"
            yield time_event
            
            if "Strategic Clarification Questions" in full_content or query_metadata.get("output_tokens") >= 180:
                research_state_data = {
                    'original_user_query': user_query,
                    'follow_up_question': full_content
                }
                await mongodb.store_deep_research_state(user_id, session_id, message_id, research_state_data)

            yield {"store_data": {"messages": current_messages_log, 'logs': message_logs, 'metadata': query_metadata}}

        elif 'follow_up_question' in previous_state and 'original_user_query' in previous_state:
            current_query = f"{previous_state['original_user_query']}\nClarification question: {previous_state['follow_up_question']}\nUser response: {user_query}\n\n"

            # store_research_message({'user_query': previous_state['original_user_query']})

            processed_output, usage_metrics = await process_query_final(current_query)
            count_usage_metrics(usage_metrics)
            message_logs += f"process_query\n{str(processed_output)}\n\n"

            tags = await asyncio.to_thread(tag_matching, processed_output)
            message_logs += f"tag_matching\n{str(tags)}\n\n"

            research_query = tags.get('researchQuery')
            subject_of_focus = tags.get('SOF')
            analysis_type = tags.get('AT')
            search_instruction = tags.get('searchInstruction')
            format_instruction = tags.get('formatInstruction')

            refine_msg = {
                'type': 'research',
                'agent_name': 'Deep Research Agent',
                'title': f"I am starting research for the query\n\n---\n`{research_query}`",
                'id': get_unique_response_id(),
            }
            yield refine_msg

            store_research_message(refine_msg)
            message_logs += f"FORMATTED MESSAGE\n{str(refine_msg)}\n\n"

            search_results = await asyncio.to_thread(tavily_search, research_query)
            message_logs += f"tavily_search\n{str(search_results)}\n\n"

            flat_string = "\n\n".join(f"URL: {item['url']}\nContent: {item['content']}" for item in search_results)

            formatted_urls = ' '.join(f"[{get_second_level_domain(item['url'])}]({item['url']})" for item in search_results)

            search_and_read_msg = {
                'type': 'research',
                'agent_name': 'Deep Research Agent',
                'title': f"I am extracting initial information from the following relevant webpages.\n\n---\nReading\n{formatted_urls}",
                'id': get_unique_response_id(),
            }
            yield search_and_read_msg

            store_research_message(search_and_read_msg)
            message_logs += f"FORMATTED MESSAGE\n{str(search_and_read_msg)}\n\n"

            topic_structure_output, usage_metrics = await generate_topic_structure(research_query, subject_of_focus, analysis_type, flat_string, search_instruction)
            count_usage_metrics(usage_metrics)
            message_logs += f"generate_topic_structure\n{str(topic_structure_output)}\n\n"

            topic_list = topic_structure_output.get("log", []) if isinstance(topic_structure_output, dict) else []
            initial_summary = topic_structure_output.get("summary")

            initial_summary_msg = {
                "type": "research",
                "agent_name": "Deep Research Agent",
                "title": f"Extracted initial information\n\n---\n_{initial_summary}_",
                "id": get_unique_response_id(),
            }
            yield initial_summary_msg

            store_research_message(initial_summary_msg)
            message_logs += f"FORMATTED MESSAGE\n{str(initial_summary_msg)}\n\n"

            partial_reports = []
            covered_topics = []
            for topic in topic_list:
                queries_output, usage_metrics = await generate_searchable_queries_from_topic_structure(topic, research_query, subject_of_focus, analysis_type, search_instruction)
                count_usage_metrics(usage_metrics)
                message_logs += f"generate_searchable_queries_from_topic_structure\n{str(queries_output)}\n\n"

                queries = queries_output.get("queries")
                markdown_queries  = ' '.join(f'`{query}`' for query in queries)

                search_queries_msg = {
                    "type": "research",
                    "agent_name": "Deep Research Agent",
                    "title": f"I am searching for information on `{topic.get('Topic')}`\n\n---\nSearching...\n{markdown_queries}",
                    "id": get_unique_response_id(),
                }
                yield search_queries_msg

                store_research_message(search_queries_msg)
                message_logs += f"FORMATTED MESSAGE\n{str(search_queries_msg)}\n\n"

                temp_content = await asyncio.to_thread(urls_extractor, queries)
                message_logs += f"urls_extractor\n{str(temp_content)}\n\n"
                
                formatted_urls_for_each_topic = ' '.join(f"[{get_second_level_domain(url)}]({url})" for url in temp_content)

                reading_urls_msg = {
                    "type": "research",
                    "agent_name": "Deep Research Agent",
                    "title": f"I am extracting information from the following relevant webpages.\n\n---\nReading\n{formatted_urls_for_each_topic}",
                    "id": get_unique_response_id(),
                }
                yield reading_urls_msg

                store_research_message(reading_urls_msg)
                message_logs += f"FORMATTED MESSAGE\n{str(reading_urls_msg)}\n\n"

                # extracted_content, summary, sources = await asyncio.to_thread(store_extracted_content, research_query, topic, temp_content)
                extracted_content, summary, sources, usage_metrics = await store_extracted_content(research_query, topic, temp_content)
                count_usage_metrics(usage_metrics)
                message_logs += f"store_extracted_content\n{str((extracted_content, summary, sources))}\n\n"

                sources_for_message.extend(sources)

                summary_msg = {
                    "type": "research",
                    "agent_name": "Deep Research Agent",
                    "title": f"Extracted information\n\n---\n_{summary}_",
                    "id": get_unique_response_id(),
                }
                yield summary_msg

                store_research_message(summary_msg)
                message_logs += f"FORMATTED MESSAGE\n{str(summary_msg)}\n\n"

                # not using if extracted content since we are already catching exceptions
                content_text = "\n\n".join(f"Link: {key}\nContent: {val}" for key, val in extracted_content.items())

                topic_report, usage_metrics = await generate_topic_report(current_query, topic.get("Topic"), topic.get("Subtopics"), content_text, covered_topics, format_instruction)
                covered_topics.append(topic.get("Topic"))
                count_usage_metrics(usage_metrics)
                message_logs += f"generate_topic_report\n{str(topic_report)}\n\n"

                partial_reports.append(topic_report)

            partial_report_str = "\n\n".join(partial_reports)

            final_sections, usage_metrics = await generate_final_report(current_query, [topic.get("Topic") for topic in topic_list], partial_report_str)
            count_usage_metrics(usage_metrics)
            message_logs += f"generate_final_report\n{str(final_sections)}\n\n"

            markdown_text = (
                f"# **{final_sections.title}**\n\n"
                # f"## **Overview:**\n"
                # f"{final_sections.overview}\n\n"
                f"{partial_report_str}\n\n"
                f"## **Conclusion:**\n"
                f"{final_sections.conclusion}"
            )

            markdown_msg = {
                "type": "response",
                "agent_name": "Deep Research Agent",
                "content": markdown_text,
                "id": get_unique_response_id(),
            }
            # yield markdown_msg
            
            async for token in send_tokens(markdown_text):
                yield {
                    "type": "response-chunk",
                    "agent_name": "Deep Research Agent",
                    "content": token,
                    "id": markdown_msg['id'],
                }

            end_time = time.monotonic()
            duration_seconds = end_time - start_time
            time_event = {"time": f"{int(duration_seconds)} sec", "message_id": message_id, "in_seconds": int(duration_seconds)}

            if duration_seconds >= 60:
                minutes = int(duration_seconds // 60)
                remaining_seconds = int(duration_seconds % 60)
                time_event["time"] = f"{minutes} min {remaining_seconds} sec"
            yield time_event

            store_research_message(markdown_msg)
            message_logs += f"FORMATTED MESSAGE\n{str(markdown_msg)}\n\n"

            await mongodb.update_session_history_in_db(session_id, user_id, message_id, previous_state['original_user_query'], markdown_text, local_time, timezone)

            final_data_event = {'state': "completed_deep_research"}
            if sources_for_message:
                final_data_event['sources'] = sources_for_message
                store_research_message({'sources': final_data_event['sources']})

            yield final_data_event

            yield {"store_data": {"messages": current_messages_log, 'logs': message_logs, 'metadata': query_metadata}}

        else:
            raise RuntimeError("Error in loading deep research state")

    except Exception as e:
        error_msg = f"Error processing deep research query: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        message_logs += f"ERROR MESSAGE\n{str(error_msg)}\n\n"
        error_event = {'error': error_msg}
        yield error_event
        

        if previous_state:
            store_research_message(error_event)
            await mongodb.update_session_history_in_db(session_id, user_id, message_id, previous_state['original_user_query'] or user_query, markdown_text or error_msg, local_time, timezone)

            yield {"store_data": {"messages": current_messages_log, 'logs': message_logs, 'metadata': query_metadata}}

    finally:
        pass
    