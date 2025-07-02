import asyncio
from beanie import Document
import requests
from langchain_core.tools import tool, BaseTool
import os
import json
import datetime
from datetime import timezone
import http.client
import tzlocal
from pydantic import BaseModel, Field
from typing import List, Literal, Type, Dict, Union, Any
from utils import pretty_format
import concurrent.futures
from .finance_scraper_utils import fetch_yahoo_finance_balance_sheet, fetch_yahoo_finance_cash_flow_sheet, fetch_yahoo_finance_income_statement, fetch_yahoo_quote_data, scrape_yahoo_stock_history, fetch_screener_balance_sheet, fetch_screener_cashflow_results, fetch_screener_income_and_summary_results, fetch_company_info, get_historical_data_fmp
from schemas.tool_structured_input import SearchCompanyInfoSchema, CompanySymbolSchema, StockDataSchema, CombinedFinancialStatementSchema, CurrencyExchangeRateSchema, TickerSchema
import mongodb
from tools.web_search_tools import AdvancedInternetSearchTool


fm_api_key = os.getenv("FM_API_KEY")
currency_api_key = os.getenv("CURRENCY_FREAK_API_KEY")


class SearchCompanyInfoTool(BaseTool):
    name: str = "search_company_info"
    description: str = """Use this function to search for financial instruments including cryptocurrencies, forex, stocks, ETFs, etc. using the company name or ticker symbol. You can provide multiple ticker symbols or company names."""
    args_schema: Type[BaseModel] = SearchCompanyInfoSchema
    
    def _fetch_fmp_data(self, query: str) -> Union[List[Dict[str, Any]], str]:
        try:
            url = f"https://financialmodelingprep.com/api/v3/search?query={query}&apikey={fm_api_key}"
            fmp_response = requests.get(url)
            return fmp_response.json()
        except Exception as e:
            return f"Error in getting company information from FMP for {query}: {str(e)}"

    def _fetch_yf_data(self, query: str) -> Union[Dict[str, Any], str]:
        try:
            return fetch_company_info(query)  # Assuming this function is defined elsewhere
        except Exception as e:
            return f"Error in getting company information from YF for {query}: {str(e)}"

    def _fetch_data_for_single_ticker(self, query: str) -> Dict[str, Any]:
        fmp_data = self._fetch_fmp_data(query)
        # yf_data = self._fetch_yf_data(query)
        
        return {
            "ticker": query,
            "fmp_data": fmp_data, 
            # "yf_data": yf_data, 
            "source": ["https://site.financialmodelingprep.com/", f"https://finance.yahoo.com/lookup/?s={query}"]
        }

    def _run(self, query: List[str], explanation: str) -> Dict[str, Any]:        
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(query)) as executor:
            # Submit tasks for each ticker
            future_to_ticker = {executor.submit(self._fetch_data_for_single_ticker, ticker): ticker for ticker in query}
            
            for future in concurrent.futures.as_completed(future_to_ticker):
                ticker = future_to_ticker[future]
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    results.append({
                        "ticker": ticker,
                        "error": f"Error processing {ticker}: {str(e)}",
                        "fmp_data": None,
                        "yf_data": None,
                        "source": []
                    })
        
        return {"results": results}


class CompanyProfileTool(BaseTool):
    name: str = "get_usa_based_company_profile"
    description: str = """Use this tool to get company profile information through its ticker symbol for USA based companies only.
This tool provides information of companies registered in NYSE and NASDAQ only."""
    args_schema: Type[BaseModel] = CompanySymbolSchema

    def _run(self, symbol: str, explanation: str):
        try:
            url = f"https://financialmodelingprep.com/api/v3/profile/{symbol}?apikey={fm_api_key}"
            response = requests.get(url)
            # return pretty_format(response.json()) + "\n\n- Source: https://site.financialmodelingprep.com/"
            return {"data": response.json(), "source": "https://site.financialmodelingprep.com/"}
        except Exception as e:
            error_msg = f"Error in getting company profile information: {str(e)}"
            return error_msg


class GetStockData(BaseTool):
    name: str = "get_stock_data"
    description: str = """Use this tool to get real-time stock quote data and historical stock prices of companies.
The realtime stock data includes price, changes, market cap, PE ratio, and more.
"""
    args_schema: Type[BaseModel] = StockDataSchema

    def _run(self, ticker_data: List[TickerSchema], explanation: str = None, period: str = "1mo"):
        def process_ticker(ticker_info):
            ticker = ticker_info.ticker
            exchange_symbol = ticker_info.exchange_symbol
            result = {"realtime": None, "historical": None}

            # Fetch Real-Time Data
            try:
                if exchange_symbol in ['NYSE', 'NASDAQ']:
                    try:
                        url = f"https://financialmodelingprep.com/api/v3/quote/{ticker}?apikey={fm_api_key}"
                        data = requests.get(url)
                        realtime_response = data.json()
                        realtime_response[0]["currency"] = "USD"
                        realtime_response = realtime_response[0]
                    except Exception as e:
                        # try:
                        #     realtime_response = fetch_yahoo_quote_data(ticker)
                        # except Exception as inner_e:
                        #     realtime_response = {"error": f"Error fetching realtime data (USA backup): {str(inner_e)}"}
                        realtime_response = {"error": f"Error fetching realtime data (USA backup): {str(e)}"}
                else:
                    # try:
                    #     realtime_response = fetch_yahoo_quote_data(ticker)
                    # except Exception as e:
                    #     realtime_response = {"error": f"Error fetching realtime data (World): {str(e)}"}
                    realtime_response = {"error": "Use web search tool for non USA data."}
                    

                result["realtime"] = realtime_response
            except Exception as e:
                result["realtime"] = {"error": f"Failed to get realtime data: {str(e)}"}

            # Fetch Historical Data
            try:
                if exchange_symbol in ['NYSE', 'NASDAQ']:
                    try:
                        historical_data = get_historical_data_fmp(ticker, period)

                        result["historical"] = {"data": historical_data, "source": "https://financialmodelingprep.com/"}
                    except Exception as e:
                        # historical_data = scrape_yahoo_stock_history(ticker, period)
                        # result["historical"] = {"data": historical_data, "source": "https://finance.yahoo.com/quote/{ticker}/history"}
                        historical_data = {"error": f"Error fetching historical data: {str(e)}"}
                        
                else:
                    # try:
                    #     historical_data = scrape_yahoo_stock_history(ticker, period)
                    #     result["historical"] = {"data": historical_data, "source": "https://finance.yahoo.com/quote/{ticker}/history"}
                    # except Exception as e:
                    #     historical_data = {"error": f"Error fetching historical data: {str(e)}"}
                    historical_data = {"error": "Use web search tool for non USA data"}


                # historical_data = scrape_yahoo_stock_history(ticker, period)
                # result["historical"] = {
                #     "data": historical_data,
                #     "source": f"https://finance.yahoo.com/quote/{ticker}/history"
                # }
            except Exception as e:
                error_msg = f"Stock history scrapping error: {e}"
                print(error_msg)
                result["historical"] = {"error": error_msg}

            return result
        
        all_results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(ticker_data)) as executor:
            future_to_ticker = {executor.submit(process_ticker, ticker_info): ticker_info for ticker_info in ticker_data}
            for future in concurrent.futures.as_completed(future_to_ticker):
                ticker_info = future_to_ticker[future]
                try:
                    result = future.result()
                    all_results.append(result)
                except Exception as e:
                    error_msg = f"Processing of {ticker_info.ticker} generated an exception: {str(e)}"
                    print(error_msg)

        return all_results


class CombinedFinancialStatementTool(BaseTool):
    name: str = "get_financial_statements"
    description: str = """This tool retrieves financial statement data (balance sheet, cash flow statement, or income statement) using various methods for companies in the U.S., India, and other regions."""

    args_schema: Type[BaseModel] = CombinedFinancialStatementSchema

    def _run(self, symbol: str, exchangeShortName: str, statement_type: str, period: str = "annual", limit: int = 1, reporting_format: str = "standalone", explanation: str = None) -> str:

        external_data_dir = "external_data"
        os.makedirs(external_data_dir, exist_ok=True)
        timestamp = datetime.datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        # Fetch data based on the exchange
        if exchangeShortName in ["NSE", "BSE"]:
            # return self._fetch_screener_data(symbol, statement_type, reporting_format, timestamp)
            return "Use web search tool for non USA data"
        elif exchangeShortName in ["NYSE", "NASDAQ"]:
            return self._fetch_us_data(symbol, statement_type, period, limit, timestamp)
        else:
            # return self._fetch_yahoo_data(symbol, statement_type, period, timestamp)
            return "Use web search tool for non USA data"

    def _fetch_screener_data(self, symbol: str, statement_type: str, reporting_format: str, timestamp: str) -> str:
        """Fetches financial statements from Screener for NSE/BSE stocks."""
        try:
            symbol = symbol.split('.')[0]
            fetch_methods = {
                "balance_sheet": fetch_screener_balance_sheet,
                "cash_flow": fetch_screener_cashflow_results,
                "income_statement": fetch_screener_income_and_summary_results
            }
            fetch_function = fetch_methods[statement_type]

            if statement_type == "income_statement":
                results = fetch_function(symbol, reporting_format)
                currency, profit_loss_df, summary_df, url = results["currency"], results[
                    "profit_loss"], results["summary"], results["source"]

                data = {
                    "currency": currency,
                    "data": {
                        "profit_loss": profit_loss_df.to_dict(orient="records"),
                        "summary": summary_df.to_dict(orient="records") if not summary_df.empty else "No summary data available."
                    }
                }
                filename = f"{symbol}_{reporting_format}_incomeStatement_and_summary_{timestamp}.json"
                # formatted_output = f"- Ticker: {symbol}\n- Currency: {currency}\n- Profit & Loss:\n{profit_loss_df.to_markdown()}\n\n- Source: {url}"
                formatted_output = f"- Ticker: {symbol}\n- Currency: {currency}\n- Profit & Loss:\n{profit_loss_df.to_markdown()}"
                return self._pretty_return(data, filename, formatted_output, url)

            df, currency, url = fetch_function(symbol, reporting_format)
            data = {"currency": currency, "data": df.to_dict(orient="records")}
            filename = f"{symbol}_{reporting_format}_{statement_type}_{timestamp}.json"
            # formatted_output = f"- Ticker: {symbol}\n- Currency: {currency}\n- {statement_type}:\n{df.to_markdown()}\n\n- Source: {url}"
            formatted_output = f"- Ticker: {symbol}\n- Currency: {currency}\n- {statement_type}:\n{df.to_markdown()}"
            return self._pretty_return(data, filename, formatted_output, url)

        except Exception as e:
            return pretty_format(f"Error retrieving {statement_type} from Screener: {str(e)}")

    def _fetch_us_data(self, symbol: str, statement_type: str, period: str, limit: int, timestamp: str):
        """Fetches financial statements from FMP or Yahoo Finance for NYSE/NASDAQ stocks."""
        try:
            # FMP API Call
            fmp_endpoints = {
                "balance_sheet": "balance-sheet-statement",
                "cash_flow": "cash-flow-statement",
                "income_statement": "income-statement"
            }
            url = f"https://financialmodelingprep.com/api/v3/{fmp_endpoints[statement_type]}/{symbol}?limit={limit}&apikey={fm_api_key}"
            response = requests.get(url)
            data = response.json()

            if isinstance(data, list) and data:
                if period == 'quarterly':
                    data.append({"Note": "I don't have access to quarterly financial statement data."})
                return data
            else:
                # Fallback to Yahoo Finance
                # return self._fetch_yahoo_data(symbol, statement_type, period, timestamp)
                return data
        except Exception as e:
            error_msg = f"Error retrieving {statement_type} from Financial Modeling Prep: {str(e)}"
            return pretty_format(error_msg)

    def _fetch_yahoo_data(self, symbol: str, statement_type: str, period: str, timestamp: str):
        """Fetches financial statements from Yahoo Finance as a backup."""
        try:
            yahoo_methods = {
                "balance_sheet": fetch_yahoo_finance_balance_sheet,
                "cash_flow": fetch_yahoo_finance_cash_flow_sheet,
                "income_statement": fetch_yahoo_finance_income_statement
            }
            fetch_function = yahoo_methods[statement_type]
            df, currency, url = fetch_function(symbol, period)

            data = {"currency": currency, "data": df.to_dict(orient="records")}
            filename = f"{symbol}_{statement_type}_{period}_{timestamp}.json"
            formatted_output = f"- Ticker: {symbol}\n- Currency: {currency}\n- {statement_type}:\n{df.to_markdown()}"
            return self._pretty_return(data, filename, formatted_output, url)

        except Exception as e:
            return pretty_format(f"Error retrieving {statement_type} from Yahoo Finance: {str(e)}")

    def _pretty_return(self, data_dict: Dict, filename: str, formatted_output: str, url: str) -> str:
        """Handles JSON saving and returns a formatted response."""
        # asyncrunner.run_coroutine(mongodb.insert_in_db([{"filename": filename, "data": data_dict}]))
        return {"data": formatted_output, "source": url}


class CurrencyRateTool(BaseTool):
    name: str = "get_currency_exchange_rate"
    description: str = """Use this tool to get the latest current currency exchange rates with USD as base."""

    args_schema: Type[BaseModel] = CurrencyExchangeRateSchema

    def _run(self, currencies: List[str] = ['INR', 'AED', 'EUR'], explanation: str = None):
        try:
            symbols_string = ",".join(currencies)
            conn = http.client.HTTPSConnection("api.currencyfreaks.com")
            payload = ''
            headers = {}
            url = f"/v2.0/rates/latest?apikey={currency_api_key}&symbols={symbols_string}"
            conn.request("GET", url, payload, headers)
            res = conn.getresponse()
            data = res.read()
            data = data.decode("utf-8")
            return f"Current exchange rate: {data}"
        except Exception as e:
            error_msg = f"Can't get latest currency exchange rates due to error: {str(e)}"
            return error_msg


class StockPriceChangeTool(BaseTool):
    name: str = "get_usa_based_company_stock_price_change"
    description: str = """Use this tool to get stock price change percentages over predefined periods (1D, 5D, 1M, etc.) for USA based companies only.
This tool provides information of companies registered in NYSE and NASDAQ only."""
    args_schema: Type[BaseModel] = CompanySymbolSchema

    def _run(self, symbol: str, explanation: str):
        try:
            url = f"https://financialmodelingprep.com/api/v3/stock-price-change/{symbol}?apikey={fm_api_key}"
            response = requests.get(url)

            return pretty_format(response.json())
        except Exception as e:
            error_msg = f"Error in getting stock price changes: {str(e)}"
            return error_msg


search_company_info = SearchCompanyInfoTool()
get_usa_based_company_profile = CompanyProfileTool()
get_stock_data = GetStockData()
get_financial_statements = CombinedFinancialStatementTool()
get_currency_exchange_rates = CurrencyRateTool()
advanced_internet_search = AdvancedInternetSearchTool()

tool_list = [
    search_company_info,
    get_usa_based_company_profile,
    get_stock_data,
    get_financial_statements,
    get_currency_exchange_rates,
    advanced_internet_search
]
