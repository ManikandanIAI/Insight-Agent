from pydantic import BaseModel, Field
from typing import List, Dict, Any, Type, Literal, Optional


# WEB SEARCH TOOLS
class WebSearchSchema(BaseModel):
    query: List[str] = Field(description="A list of one or more well structured query designed to efficiently Google search. At max there should be only four queries.")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


class WebScrapeSchema(BaseModel):
    link: str = Field(
        description="URL of the webpage to extract information from")
    information_to_extract: str = Field(
        description="Detailed information that needs to be extracted from the webpage.")


class WebPageInfoSchema(BaseModel):
    webpages: List[WebScrapeSchema] = Field(
        description="List of webpage URLs and information to extract from each webpage", strict=True)
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


class TavilyToolSchema(BaseModel):
    query: List[str] = Field(description="A list of well structured query designed to efficiently Google search finance or market related information. Each query in the list should be a bit different from the other to get a variety of search results. At max there should be only four queries.")
    # search_topic: Optional[Literal['news', 'general', 'finance']] = Field(description="Select different search topics depending on query.")
    time_range: Optional[Literal['day', 'week', 'month', 'year']] = Field(description="Select different search time range depending on query.")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


# FINANCE DATA TOOLS
class SearchCompanyInfoSchema(BaseModel):
    query: List[str] = Field(description="Multiple search queries, which can be expected ticker symbols or short names of different companies.")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


class CompanySymbolSchema(BaseModel):
    symbol: str = Field(description="Ticker symbol of the company")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


class CurrencyExchangeRateSchema(BaseModel):
    currencies: List[str] = Field(description="List of currency symbols like: ['INR', 'AED', 'EUR']")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


class TickerSchema(BaseModel):
    ticker: str = Field(description="Ticker symbol of the company (e.g., 'AAPL' for USA based companies, '005930.KS' or 'ASIANPAINT.BO' for non-USA companies).")
    exchange_symbol: str = Field(description="Symbol of StockExchange the company is registered in (e.g., 'NYSE', 'NASDAQ', 'BSE', etc.)")


class StockDataSchema(BaseModel):
    ticker_data: List[TickerSchema] = Field(description="A list of ticker ")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


class CombinedFinancialStatementSchema(BaseModel):
    symbol: str = Field(
        description="The company's ticker symbol (e.g., 'AAPL' for U.S. stocks, '005930.KS' for non-U.S. stocks, or 'RELIANCE' for NSE/BSE stocks).")
    period: Literal['annual', 'quarterly'] = Field(description="Period of the financial statement, default: 'annual'")
    limit: int = Field(description="Number of records to return, default: 1")
    reporting_format: Literal['standalone', 'consolidated'] = Field(description="Formats of Financial Statements, default: 'standalone'")
    exchangeShortName: str = Field(description="Stock Exchange symbols (e.g. 'BSE', 'NSE', 'NASDAQ', 'NYSE')")
    statement_type: Literal['balance_sheet', 'cash_flow', 'income_statement'] = Field(
        description="Types of the financial statements")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


# CODE GEN TOOL
class CodeExecutionToolInput(BaseModel):
    code: str = Field(description="Python code to execute")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


# INTERNAL DB SEARCH TOOL
class DatabaseSearchSchema(BaseModel):
    query: str = Field(description="The search query")


# SOCIAL MEDIA TOOLS
class RedditPostTextSchema(BaseModel):
    post_url: List[str] = Field(description="List of reddit post links")
    comments_limit: int = Field(description="Maximum number of comments to extract, default: 50")
    thread_replies_limit: int = Field(description="Maximum number of thread replies to extract, default: 10")
    sort: str = Field(description="Sorting method for comments, default: 'best'")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


class RedditSearchSchema(BaseModel):
    query: str = Field(description="Query to search on reddit")
    sort_type: Literal['relevance', 'hot', 'top', 'new', 'comments'] = Field(description="Post sorting format based on requirements, default: 'relevance'")
    limit_searches: int = Field(description="Number of search results to return, default: 5")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


class TwitterSearchSchema(BaseModel):
    query: List[str] = Field(description="A list of queries to efficiently search twitter. Each query in the list should be a bit different from the other to get a variety of search results. At max there should be only three queries.")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")


class GeocodeInput(BaseModel):
    places: List[str] = Field(description="List of names of the places or addresses. Strictly make sure to give the full address of the locations.")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")
