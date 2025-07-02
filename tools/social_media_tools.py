from langchain_core.tools import tool, BaseTool
import requests
from pydantic import BaseModel, Field
from typing import List, Literal, Type, Dict
from langchain_community.tools import DuckDuckGoSearchRun, DuckDuckGoSearchResults
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper, GoogleSerperAPIWrapper
from utils import pretty_format
import os
from schemas.tool_structured_input import RedditPostTextSchema, RedditSearchSchema, TwitterSearchSchema
from .finance_scraper_utils import setup_driver, WebDriverWait, EC, By, TimeoutException
from langchain_tavily import TavilySearch
from concurrent.futures import ThreadPoolExecutor, as_completed


reddit_client_id = os.getenv("REDDIT_CLIENT_ID")
reddit_client_secret = os.getenv("REDDIT_CLIENT_SECRET")
reddit_user_agent = os.getenv("REDDIT_USER_AGENT")
reddit_username = os.getenv("REDDIT_USERNAME")
reddit_password = os.getenv("REDDIT_PASSWORD")
serper_api_key = os.getenv("GOOGLE_SERPER_API_KEY")

reddit_auth = requests.auth.HTTPBasicAuth(reddit_client_id, reddit_client_secret)
reddit_data = {
    "grant_type": "password",
    "username": reddit_username,
    "password": reddit_password
}
reddit_header1 = {"User-Agent": reddit_user_agent}
reddit_response = requests.post("https://www.reddit.com/api/v1/access_token", auth=reddit_auth, data=reddit_data, headers=reddit_header1)
REDDIT_TOKEN = reddit_response.json()["access_token"]
REDDIT_HEADER = {**reddit_header1, "Authorization": f"bearer {REDDIT_TOKEN}"}


class TwitterPostSearchTool(BaseTool):
    name: str = "search_twitter"
    description: str = """Use this tool to search for latest twitter for input queries.
Returns text extracted from twitter posts.
"""
    args_schema: Type[BaseModel] = TwitterSearchSchema

    def _run(self, query: List[str], explanation: str) -> List[Dict]:
        try:
            tavily_tool = TavilySearch(max_results=5, include_domains=["x.com", "twitter.com"])
            response = []

            with ThreadPoolExecutor(max_workers=len(query)) as executor:
                future_to_query = {
                    executor.submit(self._search_with_tavily, tavily_tool, q): q for q in query
                }

                for future in as_completed(future_to_query):
                    try:
                        result = future.result()
                        response.extend(result)
                    except Exception as e:
                        query_str = future_to_query[future]
                        print(f"{query_str} generated an exception: {str(e)}")

            for post in response:
                post['snippet'] = post.pop('content') or post['title']
                post['link'] = post.pop('url')

            return response

        except Exception as e:
            error_msg = f"Failed twitter search through tavily: {str(e)}"
            return {'error': error_msg}

    def _search_with_tavily(self, tavily_tool, q):
        search_query = q
        op = tavily_tool.invoke({"query": search_query})
        print(f"Tavily search completed for: {search_query}")
        return op['results']



class RedditSearchTool(BaseTool):
    name: str = "reddit_post_search_tool"
    description: str = "This tool searches input query on Reddit and provides a list of reddit post title and link."
    args_schema: Type[BaseModel] = RedditSearchSchema

    def _run(self, query: str = "Latest finance news", sort_type: str = "relevance", limit_searches: int = 5, explanation: str = None):
        try:
            query = "+".join(query.split())
            url = f'https://oauth.reddit.com/search?q={query}&sort={sort_type}&limit={limit_searches}'
            response = requests.get(url, headers=REDDIT_HEADER)

            search_result = []
            if response.status_code == 200:
                results = response.json()
                for post in results['data']['children']:
                    title = post['data']['title']
                    link = f"https://www.reddit.com{post['data']['permalink']}"
                    search_result.append({"title": title, "link": link})
            else:
                return f"Error in reddit search api response: {response.status_code}, {response.json()}"
            return search_result
        except Exception as e:
            error_msg = f"Error in searching reddit: {str(e)}"
            return error_msg


class RedditPostTextTool(BaseTool):
    name: str = "get_reddit_post_text_tool"
    description: str = "Use this tool to extract public comments and conversations from reddit posts."
    args_schema: Type[BaseModel] = RedditPostTextSchema

    def _run(self, post_url: List[str], comments_limit: int = 50, thread_replies_limit: int = 10, sort: str = "best", explanation: str = None):
        result = []
        for post_link in post_url:
            try:
                post_id = post_link.split('/')[-3]
                api_url = f"https://oauth.reddit.com/comments/{post_id}?limit={comments_limit}&sort={sort}"

                response = requests.get(api_url, headers=REDDIT_HEADER)
                if response.status_code != 200:
                    error_info = f"Reddit Request Error: {response.status_code}, {response.text}"
                    print(error_info)
                    result.append({"link": post_link, "title": "Not Found",
                                  "post_content": "", "comment_threads": [], "error": error_info})
                    continue

                results = response.json()
                post_data = results[0]['data']['children'][0]['data']
                post_title = post_data['title']
                post_text = post_data.get('selftext', post_title)

                answer = {"link": post_link, "title": post_title, "post_content": post_text, "comment_threads": []}

                threads = results[1]['data']['children'][:comments_limit]
                for thread_idx, thread in enumerate(threads, start=1):
                    try:
                        if 'body' in thread['data']:
                            thread_comment = thread['data']['body']
                            threads_list = []
                            threads_list.append(thread_comment)
                            if not thread['data'].get('replies', {}):
                                continue
                            replies = thread['data'].get('replies', {}).get(
                                'data', {}).get('children', [])
                            valid_replies = [
                                reply for reply in replies
                                if reply['data'].get('body') and reply['data'].get('author') != '[deleted]'
                            ][:thread_replies_limit]

                            if valid_replies:
                                for reply_idx, reply in enumerate(valid_replies, start=1):
                                    reply_body = reply['data']['body']
                                    threads_list.append(reply_body)

                        answer["comment_threads"].append(threads_list)
                    except Exception as e:
                        print(
                            f"Error processing thread {thread_idx}: {str(e)}")
                        continue

                result.append(answer)
            except Exception as e:
                error_msg = f"Error processing Reddit post {post_link}: {str(e)}"
                print(error_msg)
                result.append({
                    "link": post_link,
                    "title": "Error",
                    "post_content": "",
                    "comment_threads": [],
                    "error": error_msg
                })
        return result


search_twitter = TwitterPostSearchTool()
reddit_post_search_tool = RedditSearchTool()
get_reddit_post_text_tool = RedditPostTextTool()

tool_list = [
    search_twitter,
    reddit_post_search_tool,
    get_reddit_post_text_tool
]
