import asyncio
from datetime import datetime, timezone
from langchain_community.document_loaders import PyPDFLoader, PyMuPDFLoader
import pandas as pd
from langchain_core.messages import AIMessage, ToolMessage, HumanMessage, AIMessageChunk, BaseMessage
import json
import numpy as np
import re
from typing import List, Dict, Awaitable, Any
import tldextract
import uuid
import os
import mongodb
import threading
import ipinfo
import ipaddress
from zoneinfo import ZoneInfo


ipinfo_api_key = os.environ.get("IPINFO_API_KEY")


PRICING = {
    "gpt-4.1-mini": {
        "input": 0.40 / 1_000_000,
        "output": 1.60 / 1_000_000
    },
    "gpt-4.1-nano": {
        "input": 0.100 / 1_000_000,
        "output": 0.400 / 1_000_000
    },
    "gpt-4o-mini": {
        "input": 0.15 / 1_000_000,
        "output": 0.60 / 1_000_000
    }
}


def is_private_ip(ip: str) -> bool:
    """Check if an IP address is private"""
    try:
        ip_obj = ipaddress.ip_address(ip)
        return ip_obj.is_private
    except:
        return False
    

def get_ip_info(ip_address: str):
    
    handler = ipinfo.getHandler(access_token= ipinfo_api_key) 
    details = handler.getDetails(ip_address)

    is_private = is_private_ip(ip_address)

    if is_private:
        return {}

    location_data = {
        "city": details.get('city'),
        "region": details.get('region'),
        "country": details.get('country') 
    }
    return location_data


def get_user_metadata(timezone: str, ip_address: str = ""):
    date_time = get_date_time(timezone)
    if ip_address:
        location_data = get_ip_info(ip_address)

    if not ip_address or not location_data:
        location_data = {"location": timezone}

    location_data_str = json.dumps(location_data)
    return f"<UserMetaData>\n- User's current Datetime:{date_time.isoformat()}\n - User's current location details: {location_data_str}\n</UserMetaData>"


def get_date_time(timezone: str = "UTC"):
  
    return datetime.now(ZoneInfo(timezone))


def pretty_format(obj, indent=0):
    """
    Recursively convert an object into a human-readable string with proper indentation.
    - For lists, it will join the recursively converted elements with newlines and proper indentation.
    - For dictionaries, it will produce indented lines of the form "key: value".
    - For any other type, it converts to a string.

    Args:
        obj: The object to format
        indent: The current indentation level (default: 0)

    Returns:
        A formatted string representation of the object
    """
    # Calculate the indentation string
    if obj is None:
        return ""

    # Calculate the indentation string
    indent_str = "  " * indent

    if isinstance(obj, str):
        return obj.strip() if obj.strip() else ""

    elif isinstance(obj, (list, tuple, set)):
        # Filter out None, empty strings, and empty collections
        non_empty_items = [
            item for item in obj 
            if item is not None 
            and (isinstance(item, str) and item.strip() != "" 
                 or not isinstance(item, str) and item)
        ]

        if not non_empty_items:
            return ""

        if len(non_empty_items) == 1:
            formatted = pretty_format(non_empty_items[0], indent)
            return formatted if formatted else ""

        formatted_items = [
            item for item in (pretty_format(item, indent + 1) for item in non_empty_items)
            if item
        ]
        
        if not formatted_items:
            return ""

        md = ""
        for item in formatted_items:
            md += f'{indent_str}- {item}\n'
        return md.strip()

    elif isinstance(obj, dict):
        if not obj:  # Handle empty dict
            return ""

        lines = []
        for key, value in obj.items():
            if key is None or (isinstance(key, str) and not key.strip()):
                continue

            formatted_value = pretty_format(value, indent + 1)
            if not formatted_value:  # Skip if value is empty/None
                continue

            formatted_key = pretty_format(key, indent)
            
            # Handle multi-line values
            if isinstance(value, str):
                lines.append(f"{indent_str}- {formatted_key}: {formatted_value}")
            else:
                lines.append(f"{indent_str}- {formatted_key}:\n{formatted_value}")

        return "\n".join(lines).strip()

    else:
        return str(obj) if obj is not None else ""


def get_unique_response_id():
    return "run-"+str(uuid.uuid4())


def get_unique_stock_data_id():
    return "stockData-"+str(uuid.uuid4())


def extract_file_content(file_path: str):
    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path)
        return df.head().to_markdown()
    if file_path.endswith(".xlsx"):
        df = pd.read_excel(file_path)
        return df.head().to_markdown()
    if file_path.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
        document = loader.load()
        return document[0].page_content
    if file_path.endswith(".txt"):
        with open(file_path, "r") as f:
            return f.read()
    # if file_path.endswith(".docx"):
    #     loader = DoclingLoader(file_path)
    #     document = loader.load()
    #     return document[0].page_content


def get_second_level_domain(url: str) -> str:
    extracted = tldextract.extract(url)
    if not extracted.subdomain or extracted.subdomain == "www":
        return f"{extracted.domain}.{extracted.suffix}".upper()
    else:
        return f"{extracted.subdomain}.{extracted.domain}.{extracted.suffix}".upper()


def get_favicon_link(url: str) -> str:
    return f"https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url={url}&size=32&type=svg"


def extract_subreddit_name(reddit_post_link: str) -> str:
    match = re.search(r'reddit\.com/r/([^/]+)/', reddit_post_link)
    if match:
        return "r/" + match.group(1)
    else:
        return "r/Subreddit"


def get_tool_call_title(tool_call: Dict):
    tools_list = {
        'search_company_info': 'Searching Information for `{query}`',
        'get_usa_based_company_profile': 'Getting Profile for `{ticker}`',
        'db_search_tool': 'Searching internal database for `{query}`',
    }

    if tool_call['name'] == 'search_company_info':
        return tools_list['search_company_info'].format(query=tool_call['args']['query'])
    elif tool_call['name'] == 'get_usa_based_company_profile':
        return tools_list['get_usa_based_company_profile'].format(ticker=tool_call['args']['symbol'])
    elif tool_call['name'] == 'db_search_tool':
        return tools_list['db_search_tool'].format(query=tool_call['args']['query'])


def get_token_usage_data(msg: AIMessage):
    return {'model': msg.response_metadata.get('model_name', 'gpt-4.1-mini'), **msg.usage_metadata}


async def format_tool_calling_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            for key, value in update.items():
                for field, valu in value.items():
                    if field == 'messages':
                        for msg in valu:
                            if isinstance(msg, AIMessage):
                                token_metrics = get_token_usage_data(msg)
                                response_list.append({'token_usage': token_metrics})
                                if msg.tool_calls:
                                    tool_msg_list = []
                                    for tool_call in msg.tool_calls:
                                        tool_msg = f"Using function `{tool_call['name']}` with following arguments:\n"
                                        tool_msg += pretty_format(tool_call['args'])
                                        if tool_call['args'].get('explanation'):
                                            title = tool_call['args'].get('explanation')
                                        else:
                                            title = get_tool_call_title(tool_call)
                                        tool_msg_list.append((tool_msg, title))

                                    for tool_msg in tool_msg_list:
                                        response_list.append({'type': 'research', 'agent_name': agent_name, 'content': tool_msg[0], 'title': tool_msg[1], 'id': msg.id})

                                if msg.content and not msg.tool_calls:
                                    # if not (agent_name == "Map Agent"):
                                    response_list.extend([
                                        {'type': 'research', 'agent_name': agent_name, 'title': f"**{agent_name}** has completed its task.", 'content': msg.content},
                                    ])

                            elif isinstance(msg, ToolMessage):
                                response_list.append({'agent_name': agent_name, 'title': 'Analyzing result', 'id': msg.id})
        # elif stream_mode == "messages":
        #     msg = update[0]
        #     if isinstance(msg, AIMessageChunk) and msg.content:

        return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_tool_calling_agent_update : {str(e)}")


async def format_map_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            for key, value in update.items():
                for field, valu in value.items():
                    if field == 'messages':
                        for msg in valu:
                            if isinstance(msg, AIMessage):
                                token_metrics = get_token_usage_data(msg)
                                response_list.append({'token_usage': token_metrics})
                                if msg.tool_calls:
                                    for tool_call in msg.tool_calls:
                                        tool_msg = f"Using function `{tool_call['name']}` with following arguments:\n"
                                        tool_msg += pretty_format(tool_call['args'])
                                        if tool_call['args'].get('explanation'):
                                            title = tool_call['args'].get('explanation')
                                        else:
                                            title = tool_msg
                                        response_list.append({'type': 'research', 'agent_name': agent_name, 'title': title, 'id': msg.id})

                                # if msg.content and not msg.tool_calls:
                                #     response_list.extend([
                                #         {'type': 'research', 'agent_name': agent_name, 'title': f"**{agent_name}** has completed its task.", 'id': msg.id},
                                #     ])

                            elif isinstance(msg, ToolMessage):
                                response_list.append({'agent_name': agent_name, 'title': 'Analyzing result', 'id': msg.id})
                    
                    elif field == 'structured_response':
                        pass
                        # response_list.append({'type': 'research', 'agent_name': agent_name, 'title': pretty_format(valu.model_dump()['data']), 'id': get_unique_response_id()})
                        # print(valu.model_dump()['data'])

        return response_list
    except Exception as e:
        raise e


async def format_map_agent_update_struct_response(agent_name, stream_mode, update):
    """
    Given an 'update' dict, extract all current_task.task_messages contents
    when stream_mode == "updates", and return a list of lists of strings.
    """
    try:
        response_list = []
        if stream_mode == "updates":
            message_container_key = None
            if agent_name in update:
                message_container_key = agent_name
            else:
                return response_list
            
            value = update.get(message_container_key, {})
            
            if 'messages' in value and isinstance(value['messages'], list):
                msg_list = value['messages']
                if isinstance(msg_list[-1], AIMessage):
                    token_metrics = get_token_usage_data(msg_list[-1])
                    response_list.append({'token_usage': token_metrics})

            if 'current_task' in value:
                map_data = value.get('current_task').get('task_messages', {})
                response_list.append({'type': 'map_layers', 'agent_name': agent_name, 'data': map_data, 'id': get_unique_response_id()})

        return response_list

    except Exception as e:
        # you might want to log or wrap this instead of re-raising directly
        raise RuntimeError("Error formatting map agent response") from e

    
async def format_finance_data_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":

            message_container_key = None
            if 'agent' in update:
                message_container_key = 'agent'
            elif 'tools' in update:
                message_container_key = 'tools'
            else:
                return response_list

            messages_list = update.get(message_container_key, {}).get('messages')

            if not messages_list or not isinstance(messages_list, list) or not messages_list:
                return response_list

            # msg = messages_list[0]
            for msg in messages_list:
                if isinstance(msg, AIMessage):
                    token_metrics = get_token_usage_data(msg)
                    response_list.append({'token_usage': token_metrics})

                    if msg.tool_calls:
                        for tool_call in msg.tool_calls:
                            if not isinstance(tool_call, dict):
                                continue # Skip if tool_call is not a dictionary

                            args = tool_call.get('args', {})
                            if not isinstance(args, dict): # Ensure args is a dictionary
                                args = {}

                            title = args.get('explanation')
                            if not title:
                                title = get_tool_call_title(tool_call)

                            response_list.append({
                                'type': 'research',
                                'agent_name': agent_name,
                                'title': title,
                                'id': tool_call.get('id') or get_unique_response_id()
                            })
                    elif msg.content:  # AIMessage with content but no tool_calls
                        response_list.append({
                            'type': 'research', # Or a more specific type like 'final_answer'
                            'agent_name': agent_name,
                            'title': f"**{agent_name}** has completed its task.",
                            'content': msg.content,
                            'id': msg.id
                        })

                elif isinstance(msg, ToolMessage):
                    # Initial entry for tool processing
                    response_list.append({
                        'agent_name': agent_name, # Or consider msg.name for context
                        'title': f'Analyzing result for tool: {msg.name}',
                        'id': msg.id, # ID of the ToolMessage
                    })

                    # Specific handling based on tool name
                    if msg.name == "get_stock_data":
                        data_list_from_tool = []
                        if isinstance(msg.content, str):
                            try:
                                loaded_content = json.loads(msg.content)
                                if isinstance(loaded_content, list):
                                    data_list_from_tool = loaded_content
                                elif isinstance(loaded_content, dict): # If a single item, wrap in list
                                    data_list_from_tool = [loaded_content]
                            except json.JSONDecodeError:
                                # print(f"Warning: JSON decoding failed for get_stock_data content: {msg.content}")
                                pass # Or append an error object to response_list
                        elif isinstance(msg.content, list):
                            data_list_from_tool = msg.content

                        for data_item in data_list_from_tool:
                            if isinstance(data_item, dict) and (data_item.get('realtime') is not None and data_item.get('historical') is not None) and (not 'error' in data_item.get('realtime') and not 'error' in data_item.get('historical')):
                                response_list.append({
                                    'type': 'stock_data', 'agent_name': agent_name, 'data': data_item, 'id': get_unique_stock_data_id()
                                })
                    # elif msg.name == "search_company_info": # Handling based on the provided example
                    #     try:
                    #         content_data = json.loads(msg.content)
                    #         if isinstance(content_data, dict):
                    #             sources = content_data.get("source")
                    #             # You could also extract fmp_data, yf_data if needed here:
                    #             # fmp_data = content_data.get("fmp_data")
                    #             # yf_data = content_data.get("yf_data")

                    #             processed_sources = []
                    #             if isinstance(sources, list):
                    #                 for src_url in sources:
                    #                     if isinstance(src_url, str):
                    #                         # Basic title extraction from URL (can be improved)
                    #                         domain = src_url.split('//')[-1].split('/')[0]
                    #                         processed_sources.append({
                    #                             'link': src_url,
                    #                             'title': domain,
                    #                             # 'favicon': get_favicon_link(src_url), # Requires your implementation
                    #                             # 'domain': get_second_level_domain(src_url) # Requires your implementation
                    #                         })
                    #             if processed_sources:
                    #                 response_list.append({
                    #                     'type': 'sources_info', # Custom type for this data
                    #                     'agent_name': agent_name, # Or msg.name
                    #                     'tool_name': msg.name,
                    #                     'sources': processed_sources,
                    #                     'id': msg.id, # ID of the ToolMessage
                    #                     'tool_call_id': msg.tool_call_id
                    #                 })
                    #     except json.JSONDecodeError:
                    #         # print(f"Warning: JSON decoding failed for search_company_info content: {msg.content}")
                    #         pass # Or append an error object

            return response_list
    except Exception as e:
        # Consider more specific logging or error handling
        # import traceback
        # print(f"Error in format_finance_data_agent_update_improved: {str(e)}\n{traceback.format_exc()}")
        raise RuntimeError(f"Error in format_finance_data_agent_update_improved: {str(e)}")


async def format_web_search_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            message_container_key = None
            if 'agent' in update:
                message_container_key = 'agent'
            elif 'tools' in update:
                message_container_key = 'tools'
            else:
                return response_list

            messages_list = update.get(message_container_key, {}).get('messages')

            if not messages_list or not isinstance(messages_list, list) or not messages_list:
                return response_list
            
            for msg in messages_list:
                if isinstance(msg, AIMessage):
                    token_metrics = get_token_usage_data(msg)
                    response_list.append({'token_usage': token_metrics})

                    if msg.tool_calls:
                        tool_title = {
                            'advanced_internet_search': '{explanation}\n\n---\nSearching\n{queries}',
                            'get_webpage_info': '{explanation}\n\n---\nReading\n{webpage}',
                        }
                        for tool_call in msg.tool_calls:
                            if tool_call['name'] == 'advanced_internet_search':
                                queries = ' '.join(f'`{query}`' for query in tool_call['args']['query'])
                                title = tool_title['advanced_internet_search'].format(
                                    explanation=tool_call['args']['explanation'], queries=queries)
                                response_list.append({'type': 'research', 'agent_name': agent_name, 'title': title,
                                                        'searching': tool_call['args']['query'], 'id': tool_call.get('id') or get_unique_response_id()})

                            elif tool_call['name'] == 'get_webpage_info':
                                webpage = ' '.join(f"[{get_second_level_domain(webpage['link'])}]({webpage['link']})" for webpage in tool_call['args']['webpages'])
                                links = [
                                    webpage['link'] for webpage in tool_call['args']['webpages']]
                                title = tool_title['get_webpage_info'].format(
                                    explanation=tool_call['args']['explanation'], webpage=webpage)
                                response_list.append({'type': 'research', 'agent_name': agent_name, 'title': title, 'reading': links, 'id': tool_call.get(
                                    'id') or get_unique_response_id()})

                                # for webpage in tool_call['args']['webpages']:
                                #     title = tool_title['get_webpage_info'].format(info=webpage['information_to_extract'], webpage=f'[{get_second_level_domain(webpage["link"])}]({webpage["link"]})')
                                #     response_list.append({'type': 'research', 'agent_name': agent_name, 'content': title, 'is_loading': True})

                    elif msg.content and not msg.tool_calls:
                        response_list.extend([
                            {'type': 'research', 'agent_name': agent_name,
                                'title': f"**{agent_name}** has completed its task.", 'content': msg.content, 'id': msg.id},
                        ])

                elif isinstance(msg, ToolMessage):
                    sources = []
                    if msg.name == 'get_webpage_info':
                        for webpage in json.loads(msg.content):
                            if 'link' in webpage and 'available_info' in webpage:
                                link = webpage['link']
                                source_data = {'link': link, 'title': webpage['available_info'][:25], 'snippet': webpage.get('available_info')[:150], 'favicon': get_favicon_link(link), 'domain': get_second_level_domain(link)}
                                if 'filename' in webpage:
                                    result = await mongodb.fetch_by_filename(webpage['filename'])
                                    if result:
                                        file_content=result.data
                                        source_data['title'] = file_content.get('title')
                                        if file_content.get('snippet') and not webpage.get('error'):
                                            source_data['snippet'] = file_content.get('snippet')
                                sources.append(source_data)
                    if msg.name == 'advanced_internet_search':
                        op = json.loads(msg.content)
                        if 'results' in op:
                            update_links = []
                            link_data = []
                            for result in op['results']:
                                link = result['link']
                                domain = get_second_level_domain(link)

                                source_data = {'link': link, 'favicon': get_favicon_link(link), 'domain': domain, 'title': link, 'snippet': result['content'][:150]}
                                filename = result.get('filename')
                                if filename:
                                    file_res = await mongodb.fetch_by_filename(filename)
                                    if file_res:
                                        file_content = file_res.data
                                        source_data['title'] = file_content.get('title')
                                        source_data['snippet'] = file_content.get('snippet') or file_content.get('title')
                                sources.append(source_data)
                                update_links.extend([f"[{domain}]({link})"])
                                link_data.extend([link])
                            response_list.append(
                                {'type': 'research', 'agent_name': agent_name, 'title': f"I am extracting information from the following relevant webpages.\n\n---\nReading\n{' '.join(update_links)}", 'reading': link_data, 'id': msg.id})
                    response_list.append(
                        {'agent_name': agent_name, 'content': msg.content, 'sources': sources})
            return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_web_search_agent_update : {str(e)}")

async def format_db_search_agent_aimessage(agent_name, stream_mode, update):
    try:
        response_list = []
        
        if stream_mode == "updates":
            message_container_key = None
            if 'agent' in update:
                message_container_key = 'agent'
            elif 'tools' in update:
                message_container_key = 'tools'
            else:
                return response_list

            messages_list = update.get(message_container_key, {}).get('messages')

            if not messages_list or not isinstance(messages_list, list) or not messages_list:
                return response_list
            
            for msg in messages_list:
                if isinstance(msg, AIMessage):
                    token_metrics = get_token_usage_data(msg)
                    response_list.append({'token_usage': token_metrics})

                    # Handle tool calls if present
                    if msg.tool_calls:
                        tool_title_templates = {
                            # 'execute_query': '{explanation}\n\n---\nExecuting Query\n{query}',
                            'search_audit_documents': '{explanation}\n\n---\nSearching Database {query} from {len} documents',
                            # 'validate_results': '{explanation}\n\n---\nValidating Results\n{validation_criteria}',
                        }
                        
                        for tool_call in msg.tool_calls:
                            tool_name = tool_call.get('name')
                            tool_args = tool_call.get('args', {})
                            tool_id = tool_call.get('id') or get_unique_response_id()
                            if tool_name == 'search_audit_documents':
                                query = tool_args.get('query', 'Unknown query')
                                doc_ids = tool_args.get('doc_ids', [])
                                explanation = tool_args.get('explanation', 'Searching audit documents')
                                title = tool_title_templates['search_audit_documents'].format(
                                    explanation=explanation, 
                                    query=f'`{query}`',
                                    len = len(doc_ids)
                                )
                                response_list.append({
                                    'type': 'research', 
                                    'agent_name': agent_name, 
                                    'title': title,
                                    'searching': query, 
                                    'id': tool_id
                                })

                            elif hasattr(msg, 'invalid_tool_calls') and msg.invalid_tool_calls:
                                for invalid_call in msg.invalid_tool_calls:
                                    response_list.append({
                                        'type': 'database_error', 
                                        'agent_name': agent_name, 
                                        'title': f"Invalid tool call detected",
                                        'error': f"Tool: {invalid_call.get('name', 'Unknown')}, Args: {invalid_call.get('args', 'Unknown')}", 
                                        'id': invalid_call.get('id') or get_unique_response_id()
                                    })

                    elif msg.content and not msg.tool_calls:
                        response_list.extend([
                            {
                                'type': 'database', 
                                'agent_name': agent_name,
                                'title': f"**{agent_name}** has completed its database operation.", 
                                'content': msg.content, 
                                'id': getattr(msg, 'id', get_unique_response_id())
                            },
                        ])

                    elif not msg.content and not msg.tool_calls:
                        response_list.append({
                            'type': 'database_status', 
                            'agent_name': agent_name,
                            'title': f"**{agent_name}** is processing...", 
                            'id': getattr(msg, 'id', get_unique_response_id())
                        })

                elif isinstance(msg, ToolMessage):
                    response_list.append({'agent_name': agent_name, 'title': 'Analyzing result', 'id': msg.id})

        return response_list
        
    except Exception as e:
        raise RuntimeError(f"Error in format_db_search_agent_aimessage: {str(e)}")


async def format_social_media_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            message_container_key = None
            if 'agent' in update:
                message_container_key = 'agent'
            elif 'tools' in update:
                message_container_key = 'tools'
            else:
                return response_list

            messages_list = update.get(message_container_key, {}).get('messages')

            if not messages_list or not isinstance(messages_list, list) or not messages_list:
                return response_list
            
            for msg in messages_list:
                if isinstance(msg, AIMessage):
                    token_metrics = get_token_usage_data(msg)
                    response_list.append({'token_usage': token_metrics})

                    if msg.tool_calls:
                        tool_title = {
                            'reddit_post_search_tool': '{explanation}\n\n---\nSearching Reddit\n{queries}',
                            'get_reddit_post_text_tool': '{explanation}\n\n---\nReading Subreddit Posts\n{posts}',
                            'search_twitter': '{explanation}\n\n---\nSearching Twitter/X\n{queries}'
                        }
                        for tool_call in msg.tool_calls:
                            if tool_call['name'] == 'reddit_post_search_tool':
                                title = tool_title['reddit_post_search_tool'].format(
                                    explanation=tool_call['args']['explanation'], queries=f"`{tool_call['args']['query']}`")
                                response_list.extend([{'type': 'research', 'agent_name': agent_name, 'title': title, 'searching': [
                                                        tool_call['args']['query']], 'id': tool_call.get('id') or get_unique_response_id()}])

                            elif tool_call['name'] == 'get_reddit_post_text_tool':
                                posts = ' '.join(
                                    f"[REDDIT]({post_link})" for post_link in tool_call['args']['post_url'])
                                title = tool_title['get_reddit_post_text_tool'].format(
                                    explanation=tool_call['args']['explanation'], posts=posts)
                                response_list.append({'type': 'research', 'agent_name': agent_name, 'title': title,
                                                        'reading': tool_call['args']['post_url'], 'id': tool_call.get('id') or get_unique_response_id()})

                            elif tool_call['name'] == 'search_twitter':
                                queries = ' '.join(
                                    f'`{query}`' for query in tool_call['args']['query'])
                                title = tool_title['search_twitter'].format(
                                    explanation=tool_call['args']['explanation'], queries=queries)
                                response_list.extend([{'type': 'research', 'agent_name': agent_name, 'title': title,
                                                        'searching': tool_call['args']['query'], 'id': tool_call.get('id') or get_unique_response_id()}])

                    if msg.content and not msg.tool_calls:
                        response_list.extend([
                            {'type': 'research', 'agent_name': agent_name,
                                'title': f"**{agent_name}** has completed its task.", 'content': msg.content, 'id': msg.id},
                        ])

                elif isinstance(msg, ToolMessage):
                    sources = []
                    if msg.name == 'get_reddit_post_text_tool':
                        for post in json.loads(msg.content):
                            if 'link' in post and 'title' in post:
                                sources.append({'link': post['link'], 'title': post['title'], 'snippet': post.get('snippet') or post.get('title', ''), 'favicon': get_favicon_link(post['link']), 'domain': 'REDDIT.COM'})

                    if msg.name == 'search_twitter':
                        op = json.loads(msg.content)
                        update_links = []
                        link_data = []
                        for post in op:
                            if 'link' in post and 'title' in post:
                                sources.append({'link': post['link'], 'title': post['title'], 'snippet': post.get('snippet') or post.get('title', ''), 'favicon': get_favicon_link(
                                    post['link']), 'domain': 'X.COM'})

                                update_links.extend([f"[X.com]({post['link']})"])
                                link_data.extend([post['link']])

                        response_list.append({'type': 'research', 'agent_name': agent_name, 'title': f"I am extracting information from the following twitter/X posts.\n\n---\nReading\n{' '.join(update_links)}", 'reading': link_data, 'id': msg.id})

                    response_list.append({'agent_name': agent_name, 'content': msg.content, 'sources': sources})

            return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_social_media_agent_update : {str(e)}")
    

async def format_coding_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            for key, value in update.items():
                for field, valu in value.items():
                    if field == 'messages':
                        for msg in valu:
                            if isinstance(msg, AIMessage):
                                token_metrics = get_token_usage_data(msg)
                                response_list.append({'token_usage': token_metrics})

                                if msg.tool_calls:
                                    tool_msg_list = []
                                    for tool_call in msg.tool_calls:
                                        title = f"{tool_call['args']['explanation']}\n\n---\n"
                                        title += f"```Python\n{tool_call['args']['code']}\n```"

                                        response_list.append({'type': 'research', 'agent_name': agent_name, 'title': title,
                                                             'code': tool_call['args']['code'], 'id': tool_call.get('id') or get_unique_response_id()})

                                if msg.content and not msg.tool_calls:
                                    response_list.extend([
                                        {'type': 'research', 'agent_name': agent_name,
                                            'title': f"**{agent_name}** has completed its task.", 'content': msg.content, 'id': msg.id},
                                    ])

                            elif isinstance(msg, ToolMessage):
                                response_list.extend([
                                    {'agent_name': agent_name,
                                        'content': msg.content},
                                ])
        return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_coding_agent_update : {str(e)}")


async def format_intent_detector_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            markdown_output = "**Query Review Result:**\n\n"
            message_container_key = None
            if 'Query Intent Detector' in update:
                message_container_key = 'Query Intent Detector'
            else:
                return response_list
            
            value = update.get(message_container_key, {})
            
            if value.get('messages'):
                msg = value['messages']
                if isinstance(msg, AIMessage):
                    token_metrics = get_token_usage_data(msg)
                    response_list.append({'token_usage': token_metrics})

            markdown_output += pretty_format(json.loads(msg.content))

            if value.get('final_response'):
                response = f"\n\n{value['final_response']}"
                response_list.extend([
                    {'type': 'research', 'agent_name': agent_name, 'title': markdown_output, 'id': msg.id},
                    {'type': 'response', 'agent_name': agent_name, 'content': response, 'id': msg.id}
                ])
            else:
                response_list.extend([
                    {'type': 'research', 'agent_name': agent_name, 'title': markdown_output, 'id': msg.id},
                ])
        return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_intent_detector_update : {str(e)}")


async def format_planner_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            markdown_output = "### Initial Plan:\n\n"
            message_container_key = None
            if 'Planner Agent' in update:
                message_container_key = 'Planner Agent'
            else:
                return response_list
            
            value = update.get(message_container_key, {})
            
            if 'messages' in value and isinstance(value['messages'], list):
                msg_list = value['messages']
                if isinstance(msg_list[-1], AIMessage):
                    token_metrics = get_token_usage_data(msg_list[-1])
                    response_list.append({'token_usage': token_metrics})
            
            if value.get('research_plan'):
                subtasks_list = value.get('research_plan')
                for task_id, task in subtasks_list.items():
                    markdown_output += f"- {task.get('plan')}\n"

                                
                # markdown_output = pretty_format(subtasks_list)

            response_list.extend([
                {'type': 'research', 'agent_name': agent_name, 'title': markdown_output, 'id': get_unique_response_id()}
            ])
        
        return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_planner_agent_update : {str(e)}")


async def format_executor_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            markdown_output = "Initiating the devised Plan:\n\n---\n"
            message_container_key = None
            if 'Executor Agent' in update:
                message_container_key = 'Executor Agent'
            else:
                return response_list

            value = update.get(message_container_key, {})

            if 'messages' in value and isinstance(value['messages'], list):
                msg_list = value['messages']
                if isinstance(msg_list[-1], AIMessage):
                    token_metrics = get_token_usage_data(msg_list[-1])
                    response_list.append({'token_usage': token_metrics})
            
            if value.get('task_list'):
                task_list = value['task_list']

                for subtask in task_list:
                    markdown_output += f"*{subtask['task_name']}*\n"
                    markdown_output += f"- Agent: {subtask['agent_name']}\n"
                    markdown_output += f"- Task: {subtask['agent_task']}\n"
                    markdown_output += f"- Instructions: {subtask['instructions']}\n"
                    markdown_output += f"- Expected Output: {subtask['expected_output']}\n"
                    if subtask['required_context']:
                        markdown_output += f"- Required Context: {', '.join(f'`{item}`' for item in subtask['required_context'])}\n"

                    markdown_output += "\n"

                response_list.extend([
                    {'type': 'research', 'agent_name': agent_name, 'title': markdown_output, 'id': get_unique_response_id()}
                ])

        return response_list
            
    except Exception as e:
        raise RuntimeError(f"Error in format_executor_agent_update : {str(e)}")

def clean_message_aggressive(content):
    """
    Aggressively removes XML tags, thinking tags, and their remnants
    Handles multi-line broken tags and fragments
    """
    content = re.sub(r'<[^>]*>', '', content, flags=re.DOTALL)

    content = re.sub(r'<[^>]*$', '', content, flags=re.MULTILINE)

    content = re.sub(r'^\s*>\s*', '', content, flags=re.MULTILINE)

    content = re.sub(r'>\s*', ' ', content)
    thinking_words = [
        r'\bthink\b', r'\bthinking\b', r'\bthought\b', r'\bthoughts\b',
        r'\bconsidering\b', r'\bpondering\b', r'\breflecting\b'
    ]
    
    for pattern in thinking_words:
        content = re.sub(pattern, '', content, flags=re.IGNORECASE)

    fragments = [
        r'\bink\b', r'\bth\b', r'\bnk\b', r'\bki\b', r'\bik\b',
        r'\binking\b', r'\bought\b', r'\bght\b', r'\bng\b'
    ]
    
    for fragment in fragments:
        content = re.sub(fragment, '', content, flags=re.IGNORECASE)

    # content = re.sub(r'\b[a-z]{1,2}\b', '', content, flags=re.IGNORECASE)

    # content = re.sub(r'\s+', ' ', content)
    # content = content.strip()
    
    return content

async def format_manager_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            message_container_key = None
            if 'Manager Agent' in update:
                message_container_key = 'Manager Agent'
            else:
                return response_list
            
            value = update.get(message_container_key, {})
            
            if 'messages' in value and isinstance(value['messages'], list):
                msg_list = value['messages']
                if isinstance(msg_list[-1], AIMessage):
                    token_metrics = get_token_usage_data(msg_list[-1])
                    response_list.append({'token_usage': token_metrics})

            if 'manager_instructions' in value and isinstance(value['manager_instructions'], list):
                message_list = value['manager_instructions']

                msg = message_list[-1]
                response_list.extend([{'agent_name': agent_name, 'research-manager': msg.content, 'id': msg.id}])
            
        elif stream_mode == "messages":
            msg = update[0]
            if isinstance(msg, AIMessageChunk):
                if not "<think>" in msg.content and not "</think>" in msg.content:
                    content = clean_message_aggressive(msg.content)
                    # if agent_name == "Response Generator Agent":
                    #     print("RGA here--->  ",content,"\n")
                    response_list.append({'type': 'research-chunk', 'agent_name': agent_name, 'title': content, 'id': msg.id})

        return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_manager_agent_update : {str(e)}")


async def format_task_router_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            message_container_key = None
            if 'Task Router' in update:
                message_container_key = 'Task Router'
            else:
                return response_list
            current_task_dict = update.get(message_container_key, {}).get('current_task')
            if not current_task_dict or not isinstance(current_task_dict, dict):
                return response_list
            
            
           
            markdown_output = f"**Task Router** is initiating ***{current_task_dict['agent_name']}*** to perform the task '*{current_task_dict['task_name']}*'."
            if current_task_dict.get('task_feedback'):
                markdown_output = f"**Task Validator** is retrying the task '*{current_task_dict['task_name']}*' {current_task_dict['retry']}th time through ***{current_task_dict['agent_name']}*** with following feedback:\n{current_task_dict['task_feedback']}"
            # markdown_output += f"with following instructions:\n{value['instructions']}"
            return [
                {'type': 'task_change', 'agent_name': current_task_dict['agent_name'],
                    'task_name': current_task_dict['task_name'], 'id': get_unique_response_id()}
            ]
                # else:
                #     return {'type': 'message', 'agent_name': agent_name, 'content': "Solution generated by specialized agents."}
    except Exception as e:
        raise RuntimeError(f"Error in format_task_router_update : {str(e)}")


async def format_response_generator_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            message_container_key = None
            if 'Response Generator Agent' in update:
                message_container_key = 'Response Generator Agent'
            else:
                return response_list
            
            value = update.get(message_container_key, {})

            if 'messages' in value and isinstance(value['messages'], list):
                msg_list = value['messages']
                if isinstance(msg_list[-1], AIMessage):
                    token_metrics = get_token_usage_data(msg_list[-1])
                    response_list.append({'token_usage': token_metrics})

            if 'final_response' in value:
                valu = value.get('final_response')
                response_list.extend([{'agent_name': agent_name, 'response': valu, 'id': get_unique_response_id()},])

        elif stream_mode == "messages":
            msg = update[0]
            if isinstance(msg, AIMessageChunk):
                response_list.append({'type': 'response-chunk', 'agent_name': agent_name, 'content': msg.content, 'id': msg.id})

        return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_response_generator_agent_update : {str(e)}")


async def format_validation_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            for key, value in update.items():
                for field, valu in value.items():
                    if field == 'validation_result':
                        markdown_output = f"   - Is response sufficient: {valu['is_valid']}\n"
                        markdown_output += f"   - Agent Feedback: {valu.get('feedback', 'No feedback.')}"

                        response_list.append({'type': 'validation', 'agent_name': agent_name, 'content': markdown_output, 'id': get_unique_response_id()})

        return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_validation_agent_update : {str(e)}")


async def format_non_tool_calling_agent_update(agent_name, stream_mode, update):
    try:
        response_list = []
        if stream_mode == "updates":
            for key, value in update.items():
                for field, valu in value.items():
                    if field == 'messages':
                        markdown_output = valu[-1].content.strip()
                        response_list.append(
                            {'type': 'research', 'agent_name': agent_name, 'title': f"**{agent_name}** has completed its task.", 'content': markdown_output, 'id': get_unique_response_id()}
                        )

        return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_non_tool_calling_agent_update : {str(e)}")



async def format_langgraph_message(event):
    agent_id, stream_mode, update = event
    # TOOL_CALLING_AGENTS = ["DB Search Agent", "Map Agent"]
    TOOL_CALLING_AGENTS = ["Map Agent"]
    if agent_id:
        agent_name = agent_id[0].split(':')[0]
        if agent_name in TOOL_CALLING_AGENTS:
            return await format_tool_calling_agent_update(agent_name, stream_mode, update)
        elif agent_name == "Coding Agent":
            return await format_coding_agent_update(agent_name, stream_mode, update)
        elif agent_name == "Web Search Agent":
            return await format_web_search_agent_update(agent_name, stream_mode, update)
        elif agent_name == "Social Media Scrape Agent":
            return await format_social_media_agent_update(agent_name, stream_mode, update)
        elif agent_name == "Finance Data Agent":
            return await format_finance_data_agent_update(agent_name, stream_mode, update)
        elif agent_name == 'Query Intent Detector':
            return await format_intent_detector_update(agent_name, stream_mode, update)
        elif agent_name == 'Planner Agent':
            return await format_planner_agent_update(agent_name, stream_mode, update)
        elif agent_name == 'Executor Agent':
            return await format_executor_agent_update(agent_name, stream_mode, update)
        elif agent_name == 'Task Router':
            return await format_task_router_update(agent_name, stream_mode, update)
        elif agent_name == 'Manager Agent':
            return await format_manager_agent_update(agent_name, stream_mode, update)
        elif agent_name == 'Response Generator Agent':
            return await format_response_generator_agent_update(agent_name, stream_mode, update)
        elif agent_name == 'Validation Agent':
            return await format_validation_agent_update(agent_name, stream_mode, update)
        elif agent_name == 'DB Search Agent':
            return await format_db_search_agent_aimessage(agent_name, stream_mode, update)
        else:
            return await format_non_tool_calling_agent_update(agent_name, stream_mode, update)
    else:
        for key in update.keys():
            if key == 'Query Intent Detector':
                return await format_intent_detector_update(key, stream_mode, update)
            elif key == 'Planner Agent':
                return await format_planner_agent_update(key, stream_mode, update)
            elif key == 'Executor Agent':
                return await format_executor_agent_update(key, stream_mode, update)
            elif key == 'Task Router':
                return await format_task_router_update(key, stream_mode, update)
            elif key == 'Manager Agent':
                return await format_manager_agent_update(key, stream_mode, update)
            elif key == 'Response Generator Agent':
                return await format_response_generator_agent_update(key, stream_mode, update)
            elif key == 'Validation Agent':
                return await format_validation_agent_update(key, stream_mode, update)
            elif key == "Map Agent":
                return await format_map_agent_update_struct_response(key, stream_mode, update)
            else:
                return await format_non_tool_calling_agent_update(key, stream_mode, update)


async def format_fast_agent_update(stream_mode, update):
    agent_name = "Fast Insight Agent"
    try:
        response_list = []
        if stream_mode == "updates":
            message_container_key = None
            if 'agent' in update:
                message_container_key = 'agent'
            elif 'tools' in update:
                message_container_key = 'tools'
            else:
                return response_list
            
            messages_list = update.get(message_container_key, {}).get('messages')

            if not messages_list or not isinstance(messages_list, list) or not messages_list:
                return response_list
            
            for msg in messages_list:
                if isinstance(msg, AIMessage):
                    token_metrics = get_token_usage_data(msg)
                    response_list.append({'token_usage': token_metrics})

                    if msg.tool_calls:
                        tool_title = {
                            'advanced_internet_search': '{explanation}\n\n---\nSearching\n{queries}',
                            'search_audit_documents': '{explanation}\n\n---\nSearching\n{queries}',
                        }
                        for tool_call in msg.tool_calls:
                            if tool_call['name'] == 'advanced_internet_search':
                                queries = ' '.join(f'`{query}`' for query in tool_call['args']['query'])
                                title = tool_title['advanced_internet_search'].format(explanation=tool_call['args']['explanation'], queries=queries)
                                response_list.append(
                                    {'type': 'research', 'agent_name': agent_name, 'title': title, 'searching': tool_call['args']['query'], 'id': tool_call.get('id') or get_unique_response_id()}
                                )
                            elif tool_call['name'] == 'search_audit_documents':
                                alt_explanation = "Searching from uploaded document"
                                title = tool_title['advanced_internet_search'].format(explanation=tool_call['args'].get('explanation', alt_explanation), queries=tool_call['args']['query'])
                                response_list.append(
                                    {'type': 'research', 'agent_name': agent_name, 'title': title, 'searching': tool_call['args']['query'], 'id': tool_call.get('id') or get_unique_response_id()}
                                )
                            elif tool_call['name'] == 'search_company_info':
                                title = tool_call['args'].get('explanation', "Searching for correct ticker symbol")
                                response_list.append(
                                    {'type': 'research', 'agent_name': agent_name, 'title': title, 'id': tool_call.get('id') or get_unique_response_id()}
                                )
                            elif tool_call['name'] == 'get_stock_data':
                                title = tool_call['args'].get('explanation', "Fetching the realtime and historical stock data")
                                response_list.append(
                                    {'type': 'research', 'agent_name': agent_name, 'title': title, 'id': tool_call.get('id') or get_unique_response_id()}
                                )
                    
                    elif msg.content and not msg.tool_calls:
                        response_list.extend([{'agent_name': agent_name, 'response': msg.content, 'id': get_unique_response_id()}])
                
                elif isinstance(msg, ToolMessage):
                    sources = []
                    if msg.name == 'advanced_internet_search':
                        op = json.loads(msg.content)
                        if 'results' in op:
                            update_links = []
                            link_data = []
                            for result in op['results']:
                                link = result['link']
                                domain = get_second_level_domain(link)

                                source_data = {'link': link, 'favicon': get_favicon_link(link), 'domain': domain, 'title': link, 'snippet': result['content'][:150]}
                                filename = result.get('filename')
                                if filename:
                                    file_res = await mongodb.fetch_by_filename(filename)
                                    if file_res:
                                        file_content = file_res.data
                                        source_data['title'] = file_content.get('title')
                                        source_data['snippet'] = file_content.get('snippet') or file_content.get('title')
                                sources.append(source_data)
                                update_links.extend([f"[{domain}]({link})"])
                                link_data.extend([link])
                            response_list.append(
                                {'type': 'research', 'agent_name': agent_name, 'title': f"I am extracting information from the following relevant webpages.\n\n---\nReading\n{' '.join(update_links)}", 'reading': link_data, 'id': msg.id})

                    if msg.name == "get_stock_data":
                        data_list_from_tool = []
                        if isinstance(msg.content, str):
                            try:
                                loaded_content = json.loads(msg.content)
                                if isinstance(loaded_content, list):
                                    data_list_from_tool = loaded_content
                                elif isinstance(loaded_content, dict): # If a single item, wrap in list
                                    data_list_from_tool = [loaded_content]
                            except json.JSONDecodeError:
                                # print(f"Warning: JSON decoding failed for get_stock_data content: {msg.content}")
                                pass # Or append an error object to response_list
                        elif isinstance(msg.content, list):
                            data_list_from_tool = msg.content

                        for data_item in data_list_from_tool:
                            if isinstance(data_item, dict) and (data_item.get('realtime') is not None and data_item.get('historical') is not None) and (not 'error' in data_item.get('realtime') and not 'error' in data_item.get('historical')):
                                response_list.append({
                                    'type': 'stock_data', 'agent_name': agent_name, 'data': data_item, 'id': get_unique_stock_data_id()
                                })

                    response_list.append({'agent_name': agent_name, 'content': msg.content, 'sources': sources})

        elif stream_mode == "messages":
            msg = update[0]
            if isinstance(msg, AIMessageChunk) and msg.content:
                response_list.append({'type': 'response-chunk', 'agent_name': agent_name, 'content': msg.content, 'id': msg.id})

        return response_list
    except Exception as e:
        raise RuntimeError(f"Error in format_fast_agent_update : {str(e)}")
    
 