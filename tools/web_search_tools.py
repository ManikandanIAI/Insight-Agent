import asyncio
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.utilities import GoogleSerperAPIWrapper
from langchain_community.document_loaders import PyPDFLoader, WebBaseLoader, PyMuPDFLoader
import regex as re
from utils import pretty_format
from typing import List, Dict, Any, Type, Tuple, Optional
from agents.utils import get_context_based_answer_prompt
from llm.model import get_llm, get_llm_alt
import os
from schemas.tool_structured_input import WebPageInfoSchema, WebSearchSchema, TavilyToolSchema
from collections import defaultdict
import datetime
from datetime import timezone
import json
import concurrent.futures
from langchain_tavily import TavilySearch
from utils import get_second_level_domain
import mongodb

serper_api_key = os.environ.get("GOOGLE_SERPER_API_KEY")


class InternetSearchTool(BaseTool):
    name: str = "search_internet"
    description: str = """This is a backup tool that searches input query on the internet using Google Search.
Returns search results containing website links, titles, and snippets.
"""
    args_schema: Type[BaseModel] = WebSearchSchema

    def _run(self, query: List[str], explanation: str) -> List[Dict]:
        try:
            search_tool = GoogleSerperAPIWrapper(
                serper_api_key=serper_api_key, k=6)
            # response = defaultdict(list)
            response = []
            for q in query:
                result = search_tool.results(q)
                response.extend(result.get('organic', []))
                response.extend(result.get('topStories', []))

            return response

        except Exception as e:
            print(
                f"Google Serper search failed: {str(e)}. Falling back to DuckDuckGo.")

            try:
                duckduckgo_tool = DuckDuckGoSearchResults(
                    num_results=5, output_format="list")
                response = []
                for q in query:
                    result = duckduckgo_tool.invoke(q)
                    response.extend(result)
                return response

            except Exception as fallback_e:
                error_msg = f"Both Google Serper and DuckDuckGo searches failed: {str(fallback_e)}"
                return error_msg


class WebpageInfoTool(BaseTool):
    name: str = "get_webpage_info"
    description: str = """This is a backup tool that extracts required information from given webpage urls, when websearch method is google or duckduckgo. Returns a list of dictionaries containing webpage titles, urls and available info.
"""
    args_schema: Type[BaseModel] = WebPageInfoSchema

    def _run(self, webpages: List[dict], explanation: str) -> Dict:
        tool_response = []
        file_to_write = []
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=len(webpages)) as executor:
                future_to_webpage = {
                    executor.submit(self._process_webpage, webpage): webpage
                    for webpage in webpages
                }

                for future in concurrent.futures.as_completed(future_to_webpage):
                    webpage_result = future.result()
                    if webpage_result:
                        tool_response.append(webpage_result['tool_output'])
                        file_to_write.append(webpage_result['file_to_store'])

            # if file_to_write:
                # asyncrunner.run_coroutine(mongodb.insert_in_db(file_to_write))

            return tool_response
        except Exception as e:
            error_msg = f"Error in extracting information from webpages: {str(e)}"
            print(error_msg)
            return [{'error': error_msg}]

    def _process_webpage(self, webpage):
        link = webpage.link
        information_to_extract = webpage.information_to_extract
        timestamp = datetime.datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"webpage_extraction_{timestamp}.json"

        tool_output = {'link': link, 'available_info': '', 'filename': filename}
        file_to_write = {'link': link, 'title': link, 'snippet': link,  'raw_content': ''}

        if not link.startswith(("https://", "http://")):
            raise RuntimeError("Invalid link")

        try:
            loader = WebBaseLoader([link])
            documents = loader.load()
            if documents[0].metadata.get('title'):
                file_to_write['title'] = documents[0].metadata.get('title')
            file_to_write['snippet'] = documents[0].metadata.get('description', file_to_write['title'])
            file_to_write['raw_content'] = file_to_write['snippet']
            tool_output['available_info'] = file_to_write['snippet']

            context = ""
            for doc in documents:
                context += self._clean_text(doc.page_content) + "\n\n"

            if not context.strip():
                raise RuntimeError("Unable to extract text from webpage.")

            file_to_write['raw_content'] = context

            if len(context.split()) > 600:
                tool_output['available_info'] = self._extract_info(context, information_to_extract)
            else:
                tool_output['available_info'] = context

            return {
                'tool_output': tool_output, 
                'file_to_store': {'filename': filename, 'data': file_to_write}
            }

        except Exception as e:
            tool_output['error'] = f"Unable to extract information from webpage. Error: {str(e)}"
            return {
                'tool_output': tool_output, 
                'file_to_store': {'filename': filename, 'data': file_to_write}
            }

    def _clean_text(self, text: str) -> str:
        try:
            text = re.sub(r'\n\s*\n', '\n', text)
            text = re.sub(r'\t+', ' ', text)
            text = text.strip()
            text = re.sub(r' +', ' ', text)
            return text
        except Exception as e:
            print(f"Error in cleaning webpage text: {str(e)}")
            return text

    def _extract_info(self, context: str, info_to_extract: str) -> str:
        try:
            model = get_llm("gpt-4.1-nano", 0.0)
            model_alt = get_llm_alt("gemini/gemini-2.0-flash-lite", 0.0)
            text = f"Extract the following information from the given context:\n{info_to_extract}"
            input = get_context_based_answer_prompt(context, text)

            try:
                response = model.invoke(input)
            except Exception as e:
                print(f"Falling back to alternate model: {str(e)}")
                try:
                    response = model_alt.invoke(input)
                except Exception as e:
                    print(f"Error occurred in fallback model: {str(e)}")
                    return " ".join(context.split()[:600])

            return response.content.strip()
        except Exception as e:
            error_msg = f"Error in extracting key information from webpage: {str(e)}"
            print(error_msg)
            return " ".join(context.split()[:600])


class AdvancedInternetSearchTool(BaseTool):
    name: str = "advanced_internet_search"
    description: str = """Searches input query on the internet, extracts content from the webpages and provides results.
Returns search results containing website url, title, content and score.
"""
    args_schema: Type[BaseModel] = TavilyToolSchema

    def _count_words(self, text: str) -> int:
        if not isinstance(text, str) or not text:
            return 0
        return len(text.split())

    # def _clean_text(self, text: str) -> str:
    #     if not isinstance(text, str):
    #         return ""
    #     try:
    #         text = re.sub(r'\s*\n\s*', '\n', text)
    #         text = re.sub(r'[ \t]+', ' ', text)
    #         text = text.strip()
    #         return text
    #     except Exception as e:
    #         print(f"Error cleaning text: {str(e)}")
    #         return text

    def _collapse_repeated_words(self, text: str) -> str:
        # Collapse single‐word repeats (e.g. "foo foo foo" → "foo")
        text = re.sub(r'\b(\w+)(?:\s+\1\b)+', r'\1', text)

        # Collapse small multi‐word repeats (2–6 words in a row) if they’re repeated immediately
        text = re.sub(
            r'\b((?:\w+\s+){1,5}\w+)\b(?:\s+\1\b)+',
            r'\1',
            text
        )
        return text

    def _remove_duplicate_lines(self, text: str) -> str:
        seen = set()
        new_lines = []
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped:
                if len(new_lines) == 0 or new_lines[-1].strip():
                    new_lines.append('')
                continue

            key = stripped.lower()
            if key in seen:
                continue
            seen.add(key)
            new_lines.append(line)
        return "\n".join(new_lines)

    def _remove_long_redundant_blocks(self, text: str, min_block_words: int = 30) -> str:
        tokens = text.split()
        n = len(tokens)
        if n < min_block_words * 2:
            return text  # not enough tokens to have a repeated block

        keep = [True] * n
        first_occurrence = {}

        max_phrase = min(min_block_words + 10, n // 2)

        for L in range(min_block_words, max_phrase + 1):
            for i in range(0, n - L + 1):
                if not all(keep[i:i+L]):
                    continue
                phrase = tuple(tokens[i:i+L])
                if phrase in first_occurrence:
                    # remove this run of tokens
                    for k in range(i, i+L):
                        keep[k] = False
                else:
                    first_occurrence[phrase] = i

        filtered = [tok for (tok, kf) in zip(tokens, keep) if kf]
        return " ".join(filtered)

    def _clean_text(self, text: str) -> str:
        try:
            # 1) collapse multiple blank lines → single '\n'
            text = re.sub(r'\n\s*\n', '\n', text)

            # 2) tabs → spaces
            text = re.sub(r'\t+', ' ', text)

            # 3) strip leading/trailing whitespace
            text = text.strip()

            # 4) collapse runs of spaces → single space
            text = re.sub(r' +', ' ', text)

            # 5) collapse immediate word/phrase repeats
            text = self._collapse_repeated_words(text)

            # 6) remove repeatedly‐occurring lines
            text = self._remove_duplicate_lines(text)

            # 7) optional: remove any long block (≥30 words) if repeated
            text = self._remove_long_redundant_blocks(text, min_block_words=30)

            return text
        except Exception as e:
            print(f"Error in cleaning webpage text: {str(e)}")
            return text
    
    def _prepare_output_and_file_data(self, result_dict: Dict, source: str) -> Tuple[Dict, Optional[Dict]]:
        link = result_dict.get('url') or result_dict.get('link')
        title = result_dict.get('title', 'No Title')
        raw_content = result_dict.get('raw_content')
        snippet_content = result_dict.get('content') or result_dict.get('snippet', '')

        content_for_llm = ""
        cleaned_raw_content = None

        if source == "Tavily" and raw_content:
            cleaned_raw_content = self._clean_text(raw_content)
            word_count = self._count_words(cleaned_raw_content)
            if word_count <= 2500:
                content_for_llm = cleaned_raw_content
            else:
                content_for_llm = self._clean_text(snippet_content)
        else:
            content_for_llm = self._clean_text(snippet_content)

        if content_for_llm is None:
            content_for_llm = ""

        timestamp = datetime.datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        
        domain = get_second_level_domain(link).lower()
        filename = f"{timestamp}_{source}_{domain}.json"

        tool_output = {
            'link': link,
            'content': content_for_llm,
            'filename': filename
        }

        file_data = {
            'title': title,
            'link': link,
            'snippet': snippet_content or title,
            'raw_content': cleaned_raw_content
        }

        file_data_to_write = {
            "filename": filename,
            "data": file_data
        }

        return tool_output, file_data_to_write
    
    def _run(self, query: List[str] = None, time_range: str = None, explanation: str = None) -> Dict:
        output = {'queries': query, 'results': [], 'methods': set(), 'errors': [], 'files_to_write': []}

        search_tavily = TavilySearch(max_results=5, include_raw_content=True, time_range=time_range, include_domains=None)
        search_google = GoogleSerperAPIWrapper(serper_api_key=serper_api_key, k=6)
        search_duckduckgo = DuckDuckGoSearchResults(num_results=5, output_format="list")

        def process_query(q):
            current_results = []
            files_to_store = []
            error_messages = []
            method_used = "None"

            try:
                first_search = search_tavily.invoke(input={'query': q})
                tavily_raw_results = first_search.get('results', [])

                if tavily_raw_results:
                    method_used = "Tavily"
                    for r in tavily_raw_results:
                        tool_res, file_data = self._prepare_output_and_file_data(r, "Tavily")
                        current_results.append(tool_res)
                        if file_data:
                            files_to_store.append(file_data)
                    if current_results:
                        return {"method": method_used, "results": current_results, "query": q, "files": files_to_store, "error": None}
            except Exception as e:
                error_messages.append(f"Tavily error for query '{q}': {str(e)}")

            try:
                google_structured_result = search_google.results(q)
                google_api_results = google_structured_result.get('organic', []) + google_structured_result.get('topStories', [])

                if google_api_results:
                    method_used = "Google"
                    for r in google_api_results:
                        tool_res, file_data = self._prepare_output_and_file_data(r, "Google")
                        current_results.append(tool_res)
                        if file_data:
                            files_to_store.append(file_data)
                    if current_results:
                        return {"method": method_used, "results": current_results, "query": q, "files": files_to_store, "error": None}
            except Exception as e:
                error_messages.append(f"Google error for query '{q}': {str(e)}")

            try:
                ddg_structured_results = search_duckduckgo.invoke(q)
                if ddg_structured_results:
                    search_method = "DuckDuckGo"
                    for r in ddg_structured_results:
                        tool_res, file_data = self._prepare_output_and_file_data(r, "DuckDuckGo")
                        current_results.append(tool_res)
                        if file_data:
                            files_to_store.append(file_data)
                    if current_results:
                        return {"method": method_used, "results": current_results, "query": q, "files": files_to_store, "error": None}
            except Exception as e:
                error_messages.append(f"DuckDuckGo error for query '{q}': {str(e)}")

            return {
                "method": "Failed",
                "results": [],
                "query": q,
                "files": [],
                "error": f"All search methods failed for query '{q}': " + "; ".join(error_messages)
            }

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=len(query)) as executor:
                future_to_query = {executor.submit(process_query, q): q for q in query}
                
                for future in concurrent.futures.as_completed(future_to_query):
                    try:
                        result = future.result()
                        if result["method"] != "Failed":
                            output['methods'].add(result["method"])
                            output['results'].extend(result["results"])
                            output['files_to_write'].extend(result["files"])
                        else:
                            if result.get("error"):
                                output['errors'].append(result["error"])
                    except Exception as e:
                        q = future_to_query[future]
                        err_msg = f"Critical error processing result for query '{q}': {str(e)}"
                        print(err_msg)
                        output['errors'].append(err_msg)

        except Exception as e:
            error_msg = f"Critical error during concurrent search execution: {str(e)}"
            print(error_msg)
            output['errors'].append(error_msg)
            output['methods'] = ["Execution Failed"] if not output['methods'] else output['methods']

        if output['files_to_write']:
            mongodb.insert_in_db(output['files_to_write'])

        output['methods'] = list(output['methods']) if output['methods'] else ["None"]
        del output['files_to_write']

        return output


search_internet = InternetSearchTool()
get_webpage_info = WebpageInfoTool()
advanced_internet_search = AdvancedInternetSearchTool()

tool_list = [
    advanced_internet_search,
    # get_webpage_info
]
