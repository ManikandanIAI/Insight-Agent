from langchain_tavily import TavilySearch
import re
import json
import datetime
from litellm import completion
from datetime import datetime, timezone
from .logging_utils import log_function
from .llm_utils import ResearchConfig
from .text_utils import _clean_text
from .schema import SearchableQueries, RelevanceResponse
from .prompts import SYSTEM_PROMPT_RELEVANCE_CHECK, SYSTEM_PROMPT_PROCESS_QUERY, SEARCH_QUERY_PROMPT, SYSTEM_PROMPT_PROCESS_QUERY_ENHANCED, SYSTEM_PROMPT_PROCESS_QUERY_INITIAL, SYSTEM_PROMPT_PROCESS_QUERY_FINAL
from typing import Optional, List, Dict, Any, Type
import os
from utils import get_favicon_link, get_second_level_domain
import time
from utils import get_date_time, get_unique_response_id
from litellm import completion, acompletion
import asyncio

serper_api_key = os.environ.get("GOOGLE_SERPER_API_KEY")

@log_function
def tavily_search(query: str):
    """
    Uses the TavilySearch tool to perform a search based on the refined research query.
    Returns a list of result items.
    """
    max_retries = 5
    for attempt in range(max_retries):
        try:
            tool = TavilySearch(
                max_results=3,
                topic="general",
                include_raw_content=True,
            )
            result = tool.invoke({"query": query})
            processed_results = []
            if isinstance(result, dict):
                processed_results = [item for item in result.get("results", [])]
            else:
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                else:
                    raise RuntimeError(f"No search results returned for query: {query}")

            if processed_results:
                return processed_results
            else:
                raise RuntimeError(f"No search results returned for query: {query}")
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(1)


async def process_query_initial_stream(user_query: str):
    try:
        search_query = user_query

        if len(user_query) > 150:
            prompt = f""" Make the user query into a small/compact searchable google query to perform search in a better manner, must focus on specificity, clarity, and depth. Make the query limit to less than 15 words. User query: {user_query}.
            """
            
            response = await acompletion(
                model="gpt-4.1-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
            
            search_query = response.choices[0].message.content.strip()
            
        yield {"type": "research", "agent_name": "Deep Research Agent", "title": f"Performing inital search\n\n---\nSearching\n`{search_query}`"}
        
        # print("\n--tavily--\n", search_query, "\n---\n")
        search_results = await asyncio.to_thread(tavily_search, search_query)
        
        formatted_urls = ' '.join(f"[{get_second_level_domain(item['url'])}]({item['url']})" for item in search_results)

        search_and_read_msg = {
            'type': 'research',
            'agent_name': 'Deep Research Agent',
            'title': f"I am extracting information from the webpages.\n\n---\nReading\n{formatted_urls}",
            'id': get_unique_response_id(),
        }
        
        yield search_and_read_msg

        flat_string = "\n\n".join(
            f"Title: {item['title']}\nURL: {item['url']}\nContent: {item['content']}"
            for item in search_results
        )

        user_content = user_query.strip() + "\n\nRelated web search result:\n" + flat_string

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_PROCESS_QUERY_INITIAL},
            {"role": "user", "content": user_content}
        ]

        # stream response from LLM
        response = await acompletion(
            model="gpt-4.1-mini",
            messages=messages,
            temperature=0.4,
            stream=True
        )

        full_content = ""
        response_id = get_unique_response_id()
        async for chunk in response:
            data = chunk.choices[0].delta.get("content", "")
            # print("==== chunk =====", chunk)
            if data:
                full_content += data
                # print("==== Data: ====", data)
                yield {"type": "response-chunk", "agent": "Deep Research Initial Agent", "content": data, "id": response_id}
                
            elif chunk.get("usage"):
                # print(chunk.get("usage"))
                usage = chunk.get("usage")
                usage_dict = {
                    "input_tokens": usage.prompt_tokens,
                    "output_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens
                }
                yield {
                    "usage": usage_dict
                }
    
        yield {"response": full_content, "agent_name": "Deep Research Agent", "id": response_id}

    except Exception as e:
        yield {"type": "error", "agent": "Deep Research Agent", "message": str(e)}


@log_function
async def process_query_final(user_query: str):
   """
   Handles follow-up responses or clarified queries for structured research output.
   """
   user_content = user_query.strip()

   messages = [
       {"role": "system", "content": SYSTEM_PROMPT_PROCESS_QUERY_FINAL},
       {"role": "user", "content": user_content}
   ]

   try:
       response = await acompletion(
           model="gpt-4.1-mini",
           messages=messages,
           temperature=0.4,
       )
       final_output = response.choices[0].message.content.strip()
       print("[Final Phase Output]", final_output)
       
       usage_tokens = response.get("usage")
       usage_dict = {
                    "input_tokens": usage_tokens.prompt_tokens,
                    "output_tokens": usage_tokens.completion_tokens,
                    "total_tokens": usage_tokens.total_tokens
                }
    #    print("===Usage tokens in final===", usage_dict)
       return final_output, usage_dict

   except Exception as e:
       raise RuntimeError(f"Error in final phase query: {e}") from e


# This function is used to generate search queries based on a topic
@log_function
async def generate_searchable_queries_from_topic_structure(topic_dict: Dict[str, List[str]], query: str, subject_of_focus: str, analysis_type: str, user_request_content:str = None) -> List[str]:
    topic = topic_dict.get("Topic", "")
    subtopics = topic_dict.get("Subtopics", [])
    current_dt = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    topic_str = (
    f"Current Date and Time: {current_dt}\n\n"
    f"Research Query: {query}\n"
    f"The Subject of Focus: {subject_of_focus}\n"
    f"Analysis Type: {analysis_type}\n"
    f"Main Topic: {topic}\n"
    f"Subtopics:\n" + "\n".join(f"- {sub}" for sub in subtopics) + "\n"
    )
    if user_request_content:
        topic_str += f"User Request: {user_request_content}"
    messages = [
        {"role": "system", "content": SEARCH_QUERY_PROMPT},
        {"role": "user", "content": topic_str}
    ]
    try:
        response = await acompletion(
            model="gpt-4.1-nano",
            messages=messages,
            temperature=0.6,
            response_format=SearchableQueries
        )
        queries = response.choices[0].message.content.strip()
        
        usage_tokens = response.get("usage")
        usage_dict = {
                        "input_tokens": usage_tokens.prompt_tokens,
                        "output_tokens": usage_tokens.completion_tokens,
                        "total_tokens": usage_tokens.total_tokens
                    }
        # print("===Usage tokens in generate searchable quries===", usage_dict)
        
        # If the response is a string representation of a list, evaluate it.
        # return eval(queries) if isinstance(queries, str) else queries
        if isinstance(queries, str):
            return eval(queries), usage_dict
        else:
            return queries, usage_dict
    except Exception as e:
        # print("Error generating search queries:", e)
        # return []
        raise RuntimeError(f"Error in generating search queries: {e}") from e




@log_function
async def relevance_check(research_query, topic_dict: Dict[str, List[str]],temp:Dict):
    topic = topic_dict.get("Topic", "")
    subtopics = topic_dict.get("Subtopics", [])
    current_dt = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    
    content = json.dumps(temp)
    topic_str = (
    f"Current Date and Time: {current_dt}\n\n"
    f"Research Query: {research_query}\n"
    f"Main Topic: {topic}\n"
    f"Subtopics:\n" + "\n".join(f"- {sub}" for sub in subtopics) + "\n"
    f"Content:\n : {content}"
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_RELEVANCE_CHECK},
        {"role": "user", "content": topic_str}
    ]
    try:
        response = await acompletion(
            model=ResearchConfig.LLM_MODEL,
            messages=messages,
            temperature=0.3,
            response_format=RelevanceResponse
        )
        
        raw_output = response.choices[0].message.content.strip()
        parsed_output = json.loads(raw_output)
        usage_tokens = response.get("usage")
        usage_dict = {
                        "input_tokens": usage_tokens.prompt_tokens,
                        "output_tokens": usage_tokens.completion_tokens,
                        "total_tokens": usage_tokens.total_tokens
                    }
        # print("===Usage tokens in relevance check===", usage_dict)
        
        return parsed_output, usage_dict
        
    except Exception as e:
        # print("Error generating search queries:", e)
        # return {}
        raise RuntimeError(f"Error in relevance check: {e}") from e


@log_function
def urls_extractor(queries: List[str]):
   
   
    temp_content = {}
    
    try:
        for query in queries:
            results = tavily_search(query)
            for item in results:
                url = item.get("url")
                content = item.get("content", "")
                temp_content[url] = [content]
                if item.get("raw_content"):
                    item['raw_content'] = _clean_text(item.get("raw_content"))
                if item.get("raw_content") and len(item['raw_content'].split()) < 5000:
                    temp_content[url].append(item['raw_content'])
                
                else:
                    temp_content[url].append(item.get("content", "")) 
                temp_content[url].append(item.get('title'))
        
        return temp_content
    except Exception as e:
        raise e


@log_function
async def store_extracted_content(research_query, topic_dict: Dict[str, List[str]], temp_content: Dict):
    """
    For each query, performs a Tavily search, cleans the extracted raw content,
    and stores the results in a dictionary with unique URLs.
    """
    try:
        seen_urls = set()
        extracted_data = {}
        id_url_map = {}
        id_content_map = {}
        i = 1
        for item in temp_content:
            id_url_map[f"Link_{i}"] = item
            id_content_map[f"Link_{i}"] = temp_content[item][0]
            i += 1

        # relevance = relevance_check(research_query, topic_dict, id_content_map)
        relevance, usage_metrics = await relevance_check(research_query, topic_dict, id_content_map)
        # print("===Usage tokens in store_extracted_content===", usage_metrics)
        
        for id in relevance.get("result"):
            url = id_url_map[id]
            if not url or url in seen_urls:
                continue
            else:
                extracted_data[url] = temp_content[url][1]

        sources = []
        for url in temp_content:
            title   = temp_content[url][2]
            content = temp_content[url][0]
            favicon = get_favicon_link(url)
            domain  = get_second_level_domain(url)
            sources.append({
                "link":    url,
                "title":   title,
                "snippet": content[:150],
                "favicon": favicon,
                "domain":  domain
            })


        summary = relevance.get("summary")
        
        return extracted_data, summary, sources, usage_metrics
    except Exception as e:
        raise RuntimeError(f"Failed to store extracted content for query '{research_query}': {e}") from e


# def tag_matching(processed_output: str):
#     research_query_match = re.search(r'<researchQuery>(.*?)</researchQuery>', processed_output, re.IGNORECASE | re.DOTALL)
#     sof_match = re.search(r'<SOF>(.*?)</SOF>', processed_output, re.IGNORECASE | re.DOTALL)
#     at_match = re.search(r'<AT>(.*?)</AT>', processed_output, re.IGNORECASE | re.DOTALL)
#     search_instruction_match = re.search(r'<searchInstruction>(.*?)</searchInstruction>', processed_output, re.IGNORECASE | re.DOTALL)
#     format_instruction_match = re.search(r'<formatInstruction>(.*?)</formatInstruction>', processed_output, re.IGNORECASE | re.DOTALL)
#     if research_query_match and sof_match and at_match and search_instruction_match and format_instruction_match:
#         return research_query_match, sof_match, at_match, search_instruction_match, format_instruction_match
#     else:
#         raise ValueError("No tags are found")


def tag_matching(processed_output: str) -> Dict[str, str]:
    _TAG_PATTERNS: Dict[str, re.Pattern] = {
    'researchQuery': re.compile(r'<researchQuery>(.*?)</researchQuery>',
                                re.IGNORECASE | re.DOTALL),
    'SOF':              re.compile(r'<SOF>(.*?)</SOF>',
                                re.IGNORECASE | re.DOTALL),
    'AT':               re.compile(r'<AT>(.*?)</AT>',
                                re.IGNORECASE | re.DOTALL),
    'searchInstruction':re.compile(r'<searchInstruction>(.*?)</searchInstruction>',
                                re.IGNORECASE | re.DOTALL),
    'formatInstruction':re.compile(r'<formatInstruction>(.*?)</formatInstruction>',
                                re.IGNORECASE | re.DOTALL),
    }

    results: Dict[str, str] = {}
    missing = []

    for tag, pattern in _TAG_PATTERNS.items():
        m = pattern.search(processed_output)
        if not m:
            missing.append(tag)
        else:
            results[tag] = m.group(1).strip()

    if missing:
        raise ValueError(f"Missing required tag(s): {', '.join(missing)}")

    return results