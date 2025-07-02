import os
import re
import time
import pytz
import pandas as pd
import logging
import requests
from datetime import datetime, timedelta, timezone
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.common.exceptions import NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import traceback
import re
import yfinance as yf
from collections import defaultdict


fmp_api_key = os.environ.get("FM_API_KEY")
selenium_uri = os.environ.get("SELENIUM_URI")


def setup_driver():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument("--user-agent=Mozilla/5.0 (Wayland; Ubuntu 22.04.5 LTS; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.92 Safari/537.36")
    try:
        driver = webdriver.Remote(command_executor=selenium_uri, options=options)
    except Exception as e:
        raise Exception(f"Driver SetUp Failed: {e}")

    return driver


def load_page_with_expansion(url: str, driver: webdriver.Chrome) -> str:
    """
    Loads the given URL using Selenium, clicks on all expandable '+' buttons
    to reveal hidden content, and returns the page source.
    Raises an exception if any error occurs while clicking the buttons.
    """
    driver.get(url)
    time.sleep(1)  # Allow initial load
    plus_buttons = driver.find_elements(
        By.XPATH, "//span[contains(text(), '+')]")
    for button in plus_buttons:
        try:
            driver.execute_script("arguments[0].click();", button)
            time.sleep(0.5)
        except Exception as e:
            raise Exception(f"Error clicking expandable button: {e}")
    return driver.page_source


def contains_numeric_data(table) -> bool:
    """Checks if a table contains numeric data."""
    for cell in table.find_all(['td', 'th']):
        if re.search(r'\d+', cell.get_text()):
            return True
    return False


def _parse_human_readable_number(value_str: str) -> float | int | None:
    """Converts numbers like 1.23T, 500.5M, 10K into floats or ints."""
    if not value_str or value_str == 'N/A':
        return None

    value_str = value_str.replace(',', '').strip()

    multiplier = 1
    if value_str.endswith('T'):
        multiplier = 1_000_000_000_000
        value_str = value_str[:-1]
    elif value_str.endswith('B'):
        multiplier = 1_000_000_000
        value_str = value_str[:-1]
    elif value_str.endswith('M'):
        multiplier = 1_000_000
        value_str = value_str[:-1]
    elif value_str.endswith('K'):
        multiplier = 1_000
        value_str = value_str[:-1]

    try:
        number = float(value_str)
        result = number * multiplier
        if result == int(result):
            return int(result)
        return result
    except ValueError:
        return None


def _clean_and_convert(value_str: str | None, is_int: bool = False) -> float | int | None | str:
    """Cleans common characters and converts to float or int, or returns raw string for ranges/dates."""
    if value_str is None:
        return None

    # Keep '+' or '-' for price change initially, handle later if needed
    # Remove only %, (, ) and commas for general cleaning
    cleaned_str = re.sub(r'[%,()]', '', value_str).strip()

    if cleaned_str == 'N/A' or not cleaned_str:
        return None

    try:
        # Check for known non-numeric patterns first (like date ranges)
        if re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b.*\d{4}', cleaned_str):
            return cleaned_str  # Return raw date string for date handler
        if ' - ' in cleaned_str:  # Handle numeric ranges
            return cleaned_str  # Return the raw string for range handler

        # Proceed with conversion for numbers
        cleaned_str_no_comma = cleaned_str.replace(',', '')
        if is_int:
            return int(cleaned_str_no_comma)
        else:
            # Handle potential leading '+' sign for change value
            return float(cleaned_str_no_comma.lstrip('+'))
    except ValueError:
        # Return the cleaned string itself if conversion fails
        return cleaned_str if cleaned_str else None


def _parse_and_format_earnings_date(date_str: str | None) -> str | None:
    """Parses the first date from Yahoo's earnings date string and formats to ISO."""
    if not date_str or not isinstance(date_str, str):
        return None

    try:
        # Extract the first date part (e.g., "Apr 30, 2025" from "Apr 30, 2025 - May 05, 2025")
        first_date_str = date_str.split(' - ')[0].strip()

        # Handle potential missing day (e.g., "Sep 2025") - less common but possible
        # If day is missing, strptime might fail or give unexpected results. Add handling?
        # For now, assume "Mon DD, YYYY" format

        # Parse the date string
        # Yahoo formats can vary slightly, try common ones
        dt_object = None
        possible_formats = ["%b %d, %Y", "%b %d %Y", "%Y-%m-%d"]  # Add more if needed
        for fmt in possible_formats:
            try:
                dt_object = datetime.strptime(first_date_str, fmt)
                break  # Stop if parsing succeeds
            except ValueError:
                continue  # Try next format

        if dt_object:
            # Format to ISO 8601 with default time T00:00:00.000 and UTC offset +0000
            # Note: This time is arbitrary as the source doesn't provide it.
            return dt_object.strftime("%Y-%m-%dT00:00:00.000+0000")
        else:
            print(f"Could not parse earnings date format: {first_date_str}")
            return "NA"

    except Exception as e:
        print(f"Error processing earnings date string '{date_str}': {e}")
        return "NA"


def convert_yf_to_json(df, ticker):
    result = []
    
    for date, row in df.iterrows():
        formatted_date = date.strftime("%b %d, %Y")
        
        row_dict = {
            "date": formatted_date,
            "open": f"{row[('Open', ticker)]:.2f}",
            "high": f"{row[('High', ticker)]:.2f}",
            "low": f"{row[('Low', ticker)]:.2f}",
            "close": f"{row[('Close', ticker)]:.2f}",
            "volume": f"{int(row[('Volume', ticker)]):,}"
        }
        
        result.append(row_dict)
    
    result = sorted(result, key=lambda x: datetime.strptime(x["date"], "%b %d, %Y"))
    
    return result


def convert_fmp_to_json(fmp_data, ticker):
    """
    Convert FMP API response to the same JSON format as the original code.
    Returns data in chronological order (oldest to newest).
    
    Args:
        fmp_data: List of historical data from FMP API
        ticker: Stock symbol
    """
    result = []
    
    for item in fmp_data:
        # Parse the date from FMP format (YYYY-MM-DD)
        date_obj = datetime.strptime(item['date'], "%Y-%m-%d")
        formatted_date = date_obj.strftime("%b %d, %Y")
        
        row_dict = {
            "date": formatted_date,
            "open": f"{float(item['open']):.2f}",
            "high": f"{float(item['high']):.2f}",
            "low": f"{float(item['low']):.2f}",
            "close": f"{float(item['close']):.2f}",
            "volume": f"{int(float(item['volume'])):,}"
        }
        
        result.append(row_dict)
    
    # Sort by date (oldest to newest) to match original behavior
    result = sorted(result, key=lambda x: datetime.strptime(x["date"], "%b %d, %Y"))
    
    return result

def fetch_yahoo_finance_cash_flow_sheet(ticker: str, period: str):
    """
    Fetches the cash flow data from Yahoo Finance for the given ticker.
    Returns a tuple (DataFrame, currency) if successful.
    Raises an exception if any error occurs.
    """
    driver = setup_driver()
    driver.set_page_load_timeout(30)  # Increase timeout if needed
    url = f'https://finance.yahoo.com/quote/{ticker.lower()}/cash-flow/'
    print(f"Fetching cash flow data for: {ticker}")

    try:
        try:
            driver.get(url)
            # Allow some time for dynamic content to load.
            time.sleep(5)
        except TimeoutException:
            driver.quit()
            raise Exception(
                f"Error in loading the page for {ticker} or no data found")

        if period == 'quarterly':
            try:
                print("Attempting to click the Quarterly button...")
                quarterly_button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable(
                        (By.XPATH, '//*[@id="tab-quarterly"]'))
                )
                driver.execute_script(
                    "arguments[0].click();", quarterly_button)
                time.sleep(3)
                print("Clicked Quarterly button.")
            except Exception:
                raise Exception(f"Error clicking Quarterly button")

        # Click the 'Expand All' button.
        try:
            print("Attempting to click the Expand button...")
            expand_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable(
                    (By.XPATH,
                     '//*[@id="nimbus-app"]/section/section/section/article/article/div/div[2]/div[3]/button')
                )
            )
            driver.execute_script("arguments[0].click();", expand_button)
            time.sleep(3)
            print("Clicked Expand button.")
        except Exception:
            raise Exception(f"Error clicking Expand button")

        # Parse the page.
        html = driver.page_source
        soup = BeautifulSoup(html, 'html.parser')

        # Extract currency information.
        currency_elem = soup.find("span", class_="currency")
        if currency_elem:
            currency_text = currency_elem.get_text(strip=True)
            if "Currency in" in currency_text:
                currency = currency_text.replace("Currency in", "").strip()
            else:
                currency = currency_text
        else:
            exchange_elem = soup.find("span", class_="exchange")
            if exchange_elem:
                spans = exchange_elem.find_all("span")
                if spans and len(spans) >= 3:
                    currency = spans[-1].get_text(strip=True)
                else:
                    currency = "N/A"
            else:
                currency = "N/A"

        table_container = soup.find('div', class_='tableContainer')
        if not table_container:
            raise Exception(f"No cash flow data available for {ticker}.")

        header_container = table_container.find('div', class_='tableHeader')
        if not header_container:
            raise Exception("No table header found.")
        headers = [col.get_text(strip=True) for col in header_container.find_all(
            'div', class_='column')]

        rows = table_container.find_all('div', class_='row')
        data = []
        for row in rows:
            cells = [cell.get_text(strip=True)
                     for cell in row.find_all('div', class_='column')]
            if cells:
                data.append(cells)

        if not data:
            raise Exception(f"No rows found for {ticker}.")

        driver.quit()
        df = pd.DataFrame(data, columns=headers)

        return df, currency, url

    except WebDriverException:
        driver.quit()
        raise Exception(f"Error fetching data for {ticker}")


def fetch_yahoo_finance_balance_sheet(ticker: str, period: str):
    """
    Fetches the balance sheet data from Yahoo Finance for the given ticker.
    Returns a tuple (df, currency) where:
      - df is a pandas DataFrame containing the balance sheet data,
      - currency is a string representing the currency, or "N/A" if not found.
    Raises an exception if any error occurs.
    """
    driver = setup_driver()
    driver.set_page_load_timeout(30)  # Increase timeout if needed
    url = f'https://finance.yahoo.com/quote/{ticker.lower()}/balance-sheet/'
    print(f"Fetching balance sheet data for: {ticker}")

    try:
        try:
            driver.get(url)
            # Allow some time for dynamic content to load.
            time.sleep(5)
        except TimeoutException:
            driver.quit()
            raise Exception(
                f"Error in loading the page for {ticker} or No Page Found")

        if period == 'quarterly':
            # Attempt to click 'Quarterly' if the button is available.
            try:
                print("Attempting to click the Quarterly button...")
                quarterly_button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable(
                        (By.XPATH, '//*[@id="tab-quarterly"]'))
                )
                driver.execute_script(
                    "arguments[0].click();", quarterly_button)
                time.sleep(3)
                print("Clicked Quarterly button.")
            except Exception as e:
                raise Exception(f"Error clicking the Quarterly button")

        # Attempt to click 'Expand All' if the button is available.
        try:
            print("Attempting to click the Expand button...")
            expand_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable(
                    (By.XPATH,
                     '//*[@id="nimbus-app"]/section/section/section/article/article/div/div[2]/div[3]/button')
                )
            )
            driver.execute_script("arguments[0].click();", expand_button)
            time.sleep(3)
            print("Clicked Expand button.")
        except Exception as e:
            raise Exception(f"Error clicking the Expand button")

        # Parse the page using BeautifulSoup.
        html = driver.page_source
        soup = BeautifulSoup(html, 'html.parser')

        # Extract currency information.
        currency_elem = soup.find("span", class_="currency")
        if currency_elem:
            currency_text = currency_elem.get_text(strip=True)
            if "Currency in" in currency_text:
                currency = currency_text.replace("Currency in", "").strip()
            else:
                currency = currency_text
        else:
            exchange_elem = soup.find("span", class_="exchange")
            if exchange_elem:
                spans = exchange_elem.find_all("span")
                if spans and len(spans) >= 3:
                    currency = spans[-1].get_text(strip=True)
                else:
                    currency = "N/A"
            else:
                currency = "N/A"

        table_container = soup.find('div', class_='tableContainer')
        if not table_container:
            raise Exception(f"No balance sheet data available for {ticker}.")

        # Extract headers.
        header_container = table_container.find('div', class_='tableHeader')
        if not header_container:
            raise Exception("No table header found.")
        headers = [col.get_text(strip=True) for col in header_container.find_all(
            'div', class_='column')]

        # Extract rows.
        rows = table_container.find_all('div', class_='row')
        data = []
        for row in rows:
            cells = [cell.get_text(strip=True)
                     for cell in row.find_all('div', class_='column')]
            if cells:
                data.append(cells)

        if not data:
            raise Exception(f"No rows found for {ticker}.")

        driver.quit()
        df = pd.DataFrame(data, columns=headers)
        return df, currency, url

    except WebDriverException as e:
        driver.quit()
        raise Exception(f"Error fetching data for {ticker}")


def fetch_yahoo_finance_income_statement(ticker: str, period: str):
    """
    Fetches the income statement data from Yahoo Finance for the given ticker.
    Returns a tuple (df, currency) if successful.
    Raises an exception if any error occurs.
    """
    driver = setup_driver()
    driver.set_page_load_timeout(30)  # Increase timeout if needed
    url = f'https://finance.yahoo.com/quote/{ticker.lower()}/financials/'
    print(f"Fetching income statement data for: {ticker}")

    try:
        try:
            driver.get(url)
            # Allow some time for dynamic content to load.
            time.sleep(5)
        except TimeoutException:
            driver.quit()
            raise Exception(
                f"Error in loading the page for {ticker} or No Page Found")

        if period == 'quarterly':
            # Attempt to click 'Quarterly' if the button is available.
            try:
                print("Attempting to click the Quarterly button...")
                quarterly_button = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable(
                        (By.XPATH, '//*[@id="tab-quarterly"]'))
                )
                driver.execute_script(
                    "arguments[0].click();", quarterly_button)
                time.sleep(3)
                print("Clicked Quarterly button.")
            except Exception as e:
                raise Exception(f"Error clicking the Quarterly button")

        # Attempt to click 'Expand All' if the button is available.
        try:
            print("Attempting to click the Expand button...")
            expand_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable(
                    (By.XPATH,
                     '//*[@id="nimbus-app"]/section/section/section/article/article/div/div[2]/div[3]/button')
                )
            )
            driver.execute_script("arguments[0].click();", expand_button)
            time.sleep(3)
            print("Clicked Expand button.")
        except Exception as e:
            raise Exception(f"Error clicking the Expand button")

        # Parse the page using BeautifulSoup.
        html = driver.page_source
        soup = BeautifulSoup(html, 'html.parser')

        # Extract currency information.
        currency_elem = soup.find("span", class_="currency")
        if currency_elem:
            currency_text = currency_elem.get_text(strip=True)
            if "Currency in" in currency_text:
                currency = currency_text.replace("Currency in", "").strip()
            else:
                currency = currency_text
        else:
            exchange_elem = soup.find("span", class_="exchange")
            if exchange_elem:
                spans = exchange_elem.find_all("span")
                if spans and len(spans) >= 3:
                    currency = spans[-1].get_text(strip=True)
                else:
                    currency = "N/A"
            else:
                currency = "N/A"

        table_container = soup.find('div', class_='tableContainer')
        if not table_container:
            raise Exception(
                f"No income statement data available for {ticker}.")

        # Extract headers.
        header_container = table_container.find('div', class_='tableHeader')
        if not header_container:
            raise Exception("No table header found.")
        headers = [col.get_text(strip=True) for col in header_container.find_all(
            'div', class_='column')]

        # Extract rows.
        rows = table_container.find_all('div', class_='row')
        data = []
        for row in rows:
            cells = [cell.get_text(strip=True)
                     for cell in row.find_all('div', class_='column')]
            if cells:
                data.append(cells)

        if not data:
            raise Exception(f"No rows found for {ticker}.")

        driver.quit()
        df = pd.DataFrame(data, columns=headers)
        return df, currency, url

    except WebDriverException as e:
        driver.quit()
        raise Exception(f"Error fetching data for {ticker}")


def fetch_yahoo_quote_data(ticker: str):
    driver = setup_driver()
    url = f"https://finance.yahoo.com/quote/{ticker}/"

    try:
        driver.get(url)
        WebDriverWait(driver, 60).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'section[data-testid="quote-hdr"]'))
        )
    except Exception as e:
        error_msg = f"Error loading {url}: {e}"
        print(error_msg)
        return {'error': error_msg}

    scraped_data = {'symbol': ticker}
    raw_earnings_date_str = None

    try:
        # --- Header Info ---
        header = driver.find_element(By.CSS_SELECTOR, 'section[data-testid="quote-hdr"]')
        if not header:
            return {'error': 'Quote header section not found'}
        name_elem = header.find_element(By.CSS_SELECTOR, 'h1')
        if name_elem:
            full_name = name_elem.text.strip()
            scraped_data['name'] = re.sub(r'\s*\([^)]*\)$', '', full_name).strip()

        try:
            exchange_text = header.find_element(By.CSS_SELECTOR, 'span.exchange').text.strip()
            parts = exchange_text.split('•')
            if parts:
                first_part = parts[0].split('-')
                scraped_data['exchange'] = first_part[0].strip() if first_part else parts[0].strip()
            scraped_data['currency'] = parts[-1].strip() if len(parts) > 1 else (
                re.search(r'\b(USD|EUR|GBP|JPY|CAD|AUD|AED|CHF|CNY|INR|HKD|SGD)\b', exchange_text).group(1)
                if re.search(r'\b(USD|EUR|GBP|JPY|CAD|AUD|AED|CHF|CNY|INR|HKD|SGD)\b', exchange_text) else 'NA'
            )
        except Exception:
            scraped_data['exchange'] = 'NA'
            scraped_data['currency'] = 'NA'

        # --- Price Info ---
        quote = driver.find_element(By.CSS_SELECTOR, 'section[data-testid="quote-price"]')
        price_elem = quote.find_element(By.CSS_SELECTOR, '[data-testid="qsp-price"]')
        scraped_data['price'] = _clean_and_convert(price_elem.text.strip()) if price_elem else 0

        change_elem = quote.find_element(By.CSS_SELECTOR, '[data-testid="qsp-price-change"]')
        scraped_data['change'] = _clean_and_convert(change_elem.text.strip()) if change_elem else 0

        percent_elem = quote.find_element(By.CSS_SELECTOR, '[data-testid="qsp-price-change-percent"]')
        scraped_data['changesPercentage'] = _clean_and_convert(percent_elem.text.strip()) if percent_elem else 0

        # --- Statistics Section ---
        stats = driver.find_element(By.CSS_SELECTOR, '[data-testid="quote-statistics"]')
        if not stats :
            return {'error': 'Quote statistics section not found'}
        items = stats.find_elements(By.CSS_SELECTOR, 'li')

        stats_mapping = {
            'Previous Close': 'previousClose', 'Open': 'open', "Day's Range": 'dayRange',
            '52 Week Range': 'yearRange', 'Volume': 'volume', 'Avg. Volume': 'avgVolume',
            'Market Cap': 'marketCap', 'Market Cap (intraday)': 'marketCap',
            'PE Ratio (TTM)': 'pe', 'EPS (TTM)': 'eps', 'Earnings Date': 'earningsDate_raw_label'
        }

        for item in items:
            try:
                label_elem = item.find_element(By.CSS_SELECTOR, 'span.label')
                value_elem = item.find_elements(By.CSS_SELECTOR, 'span.value') or item.find_elements(By.CSS_SELECTOR, 'fin-streamer')
                if not label_elem or not value_elem:
                    continue

                label_text = label_elem.get_attribute('title') or label_elem.text.strip()
                value_text = value_elem[0].text.strip()
                mapped_key = stats_mapping.get(label_text)

                if mapped_key == 'earningsDate_raw_label':
                    raw_earnings_date_str = _clean_and_convert(value_text)
                    continue
                elif mapped_key in ['dayRange', 'yearRange']:
                    parts = _clean_and_convert(value_text).split(' - ')
                    if len(parts) == 2:
                        low_val = _clean_and_convert(parts[0])
                        high_val = _clean_and_convert(parts[1])
                        if mapped_key == 'dayRange':
                            scraped_data['dayLow'] = low_val
                            scraped_data['dayHigh'] = high_val
                        else:
                            scraped_data['yearLow'] = low_val
                            scraped_data['yearHigh'] = high_val
                    else:
                        if mapped_key == 'dayRange':
                            scraped_data['dayLow'] = scraped_data['dayHigh'] = 0
                        else:
                            scraped_data['yearLow'] = scraped_data['yearHigh'] = 0
                elif mapped_key in ['marketCap', 'volume', 'avgVolume']:
                    scraped_data[mapped_key] = _parse_human_readable_number(value_text)
                elif mapped_key in ['previousClose', 'open', 'pe', 'eps']:
                    scraped_data[mapped_key] = _clean_and_convert(value_text)
            except Exception:
                continue

        # --- Earnings Date ---
        scraped_data['earningsAnnouncement'] = _parse_and_format_earnings_date(raw_earnings_date_str)
        scraped_data['timestamp'] = int(time.time())

        # --- Assemble Final Output ---
        required_keys = [
            "symbol", "name", "price", "changesPercentage", "change", "dayLow",
            "dayHigh", "yearHigh", "yearLow", "marketCap", "priceAvg50",
            "priceAvg200", "exchange", "volume", "avgVolume", "open",
            "previousClose", "eps", "pe", "earningsAnnouncement",
            "sharesOutstanding", "timestamp", "currency"
        ]

        numeric_fields = [
            "price", "changesPercentage", "change", "dayLow", "dayHigh",
            "yearHigh", "yearLow", "marketCap", "priceAvg50", "priceAvg200",
            "volume", "avgVolume", "open", "previousClose", "eps", "pe", "sharesOutstanding"
        ]

        final_output = {}
        for key in required_keys:
            if key in scraped_data:
                if key in numeric_fields:
                    final_output[key] = scraped_data[key] if isinstance(scraped_data[key], (int, float)) else 0
                else:
                    final_output[key] = scraped_data[key]
            else:
                final_output[key] = 0 if key in numeric_fields else 'NA'

        driver.quit()
        return final_output

    except Exception as e:
        traceback.print_exc()
        error_msg = f"Error in getting realtime stock data for {ticker}: {e}"
        print(error_msg)
        driver.quit()
        return {'error': error_msg}


def scrape_yahoo_stock_history(ticker: str, period: str) -> pd.DataFrame:
    """
    Retrieve historical data for a given ticker from Yahoo Finance using Selenium.
    """
    try:
        driver = setup_driver()

        def datetime_to_unix(dt_str):
            naive_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
            return int(naive_dt.timestamp())

        frequency = "1d"
        today = datetime.now(timezone.utc)

        # Date calculations
        if period == "1mo":
            start_date = (today - timedelta(days=31)).strftime("%Y-%m-%d 09:30:00")
        elif period == "3mo":
            start_date = (today - timedelta(days=93)).strftime("%Y-%m-%d 09:30:00")
        elif period == "6mo":
            start_date = (today - timedelta(days=186)).strftime("%Y-%m-%d 09:30:00")
            frequency = "1wk"
        elif period == "ytd":
            start_date = datetime(today.year, 1, 1).strftime("%Y-%m-%d 09:30:00")
            if today - datetime(today.year, 1, 1) > timedelta(days=92):
                frequency = "1wk"
        elif period == "1y":
            start_date = (today - timedelta(days=365)).strftime("%Y-%m-%d 09:30:00")
            frequency = "1wk"
        elif period == "5y":
            start_date = (today - timedelta(days=1825)).strftime("%Y-%m-%d 09:30:00")
            frequency = "1mo"
        elif period == "max":
            start_date = (today - timedelta(days=7300)).strftime("%Y-%m-%d 09:30:00")
            frequency = "1mo"
        else:
            start_date = (today - timedelta(days=30)).strftime("%Y-%m-%d 09:30:00")

        df = yf.Tickers([ticker]).history(period=period, interval=frequency)
        # print(df.to_markdown())
        if not df.empty:
            historical_data = convert_yf_to_json(df, ticker)
            return historical_data

        else:
            end_date = today.strftime("%Y-%m-%d 16:00:00")
            p1 = datetime_to_unix(start_date)
            p2 = datetime_to_unix(end_date)

            url = f"https://finance.yahoo.com/quote/{ticker}/history/?frequency={frequency}&period1={p1}&period2={p2}"
            
            driver.get(url)

            print(f"Navigated to URL: {url}")

            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="history-table"] table'))
            )
            print("History table element is present.")

            table_container = driver.find_element(By.CSS_SELECTOR, '[data-testid="history-table"]')
            table = table_container.find_element(By.TAG_NAME, "table")
            print("Table found.")

            # Find table headers
            thead = table.find_element(By.TAG_NAME, "thead")
            header_row = thead.find_element(By.TAG_NAME, "tr")
            headers_list = [th.text.strip() for th in header_row.find_elements(By.TAG_NAME, "th")]
            num_headers = len(headers_list)
            
            if num_headers == 0:
                raise Exception("No table headers found. Check selectors or page structure.")
            print(f"Headers found ({num_headers}): {headers_list}")

            data_rows_for_df = []
            tbody = table.find_element(By.TAG_NAME, "tbody")
            body_rows = tbody.find_elements(By.TAG_NAME, "tr")
            print(f"Found {len(body_rows)} rows in table body.")

            for i, row in enumerate(body_rows):
                cols = row.find_elements(By.TAG_NAME, "td")
                
                if not cols:
                    print(f"Row {i+1}: No 'td' elements found, skipping.")
                    continue

                row_data = [col.text.strip() for col in cols]

                if len(row_data) == num_headers:
                    data_rows_for_df.append(row_data)
                else:
                    is_special_row = False
                    if len(cols) > 0:
                        first_col_text = cols[0].text.strip().lower()
                        if "dividend" in first_col_text or "split" in first_col_text:
                            is_special_row = True
                        for col_element in cols:
                            if col_element.get_attribute("colspan"):
                                is_special_row = True
                                break
                    
                    if is_special_row:
                        print(f"Row {i+1}: Identified as a special row (e.g., dividend, split) and skipped. Data: {row_data}")
                    else:
                        print(f"Row {i+1}: Number of columns ({len(row_data)}) does not match number of headers ({num_headers}). Skipping. Data: {row_data}")
                    continue
            
            if not data_rows_for_df:
                if len(body_rows) > 0:
                    raise Exception("No data rows matching header count found. All rows were skipped or special.")
                else:
                    raise Exception("No historical data rows (<tr> in <tbody>) found at all.")

            driver.quit()

            df = pd.DataFrame(data_rows_for_df, columns=headers_list)
            print("DataFrame created successfully.")

            def clean_column_name(col: str) -> str:
                col_lower = col.lower()
                if "adj close" in col_lower:
                    return "adj close"
                elif "close" in col_lower:
                    return "close"
                return col_lower

            df.columns = [clean_column_name(col) for col in df.columns]
            df = df.drop('adj close', axis=1)
            # print(f"DataFrame columns cleaned: {df.columns.tolist()}")
            # print(df.to_markdown())
            
            scraped_data_list = df.to_dict(orient='records')
            # print(scraped_data_list)


            if scraped_data_list: # Ensure list is not empty before reversing
                scraped_data_list = scraped_data_list[::-1]
                return scraped_data_list
            else:
                print("No data to reverse (list is empty).")
                raise RuntimeError("Cannot get data")

    except Exception as e:
        print(f"Error in fetching historical data for {ticker}: {e}")
        raise e


def get_historical_data_fmp(ticker: str, period: str):
    """
    Retrieve historical data for a given ticker from Financial Modeling Prep API.
    Uses simple datetime grouping since FMP data already excludes non-trading days.
    
    Args:
        ticker: Stock symbol (e.g., "AAPL")
        period: Time period ("1mo", "3mo", "6mo", "ytd", "1y", "5y", "max")
        api_key: Your FMP API key
    """
    try:
        frequency = "1d"
        today = datetime.now(timezone.utc)

        # Date calculations - matching exact logic from original
        if period == "1mo":
            start_date = today - timedelta(days=31)
            frequency = "1d"
        elif period == "3mo":
            start_date = today - timedelta(days=93)
            frequency = "1d"
        elif period == "6mo":
            start_date = today - timedelta(days=186)
            frequency = "1wk"
        elif period == "ytd":
            start_date = datetime(today.year, 1, 1, tzinfo=timezone.utc)
            if today - datetime(today.year, 1, 1, tzinfo=timezone.utc) > timedelta(days=92):
                frequency = "1wk"
            else:
                frequency = "1d"
        elif period == "1y":
            start_date = today - timedelta(days=365)
            frequency = "1wk"
        elif period == "5y":
            start_date = today - timedelta(days=1825)
            frequency = "1mo"
        elif period == "max":
            start_date = today - timedelta(days=7300)
            frequency = "1mo"
        else:
            # Default case
            start_date = today - timedelta(days=30)
            frequency = "1d"

        # Format dates for FMP API
        from_date = start_date.strftime("%Y-%m-%d")
        to_date = today.strftime("%Y-%m-%d")
        
        # FMP API endpoint
        base_url = "https://financialmodelingprep.com/api/v3/historical-price-full"
        url = f"{base_url}/{ticker}?from={from_date}&to={to_date}&apikey={fmp_api_key}"
        
        print(f"Fetching data from FMP API: {url}")
        print(f"Period: {period}, Frequency: {frequency}")
        
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        if 'historical' in data and data['historical']:
            raw_data = data['historical']
            
            # Convert to our JSON format first
            formatted_data = convert_fmp_to_json(raw_data, ticker)
            
            # Apply frequency filtering using simple datetime grouping
            filtered_data = apply_frequency_filter_simple(formatted_data, frequency)
            
            if filtered_data:
                return filtered_data
            else:
                raise RuntimeError("No data available after filtering")
        else:
            raise RuntimeError("No historical data found from FMP API")
            
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from FMP API: {e}")
        raise e
    except Exception as e:
        print(f"Error in fetching historical data for {ticker}: {e}")
        raise e

def apply_frequency_filter_simple(data, frequency):
    """
    Apply frequency filtering using simple datetime grouping.
    Since FMP data already excludes weekends/holidays, we just group and take last of each period.
    
    Args:
        data: List of formatted data with 'date' in "MMM DD, YYYY" format
        frequency: "1d", "1wk", or "1mo"
    """
    if frequency == "1d":
        return data
    elif frequency == "1wk":
        return get_last_trading_day_of_week(data)
    elif frequency == "1mo":
        return get_last_trading_day_of_month(data)
    else:
        return data

def get_last_trading_day_of_week(data):
    """
    Group data by week and return the last trading day of each week.
    Uses ISO week calendar (Monday-Sunday weeks).
    
    Args:
        data: List of data with 'date' in "MMM DD, YYYY" format
    """
    if not data:
        return []
    
    # Group by week
    weekly_groups = defaultdict(list)
    
    for item in data:
        date_obj = datetime.strptime(item['date'], "%b %d, %Y")
        
        # Get ISO week (year, week_number)
        iso_year, iso_week, _ = date_obj.isocalendar()
        week_key = f"{iso_year}-W{iso_week:02d}"
        
        weekly_groups[week_key].append((date_obj, item))
    
    # Get the last trading day from each week
    result = []
    for week_key in sorted(weekly_groups.keys()):
        week_data = weekly_groups[week_key]
        # Sort by date and take the last one (most recent in the week)
        week_data.sort(key=lambda x: x[0])
        last_trading_day = week_data[-1][1]  # Get the data item
        result.append(last_trading_day)
    
    return result

def get_last_trading_day_of_month(data):
    """
    Group data by month and return the last trading day of each month.
    
    Args:
        data: List of data with 'date' in "MMM DD, YYYY" format
    """
    if not data:
        return []
    
    # Group by month
    monthly_groups = defaultdict(list)
    
    for item in data:
        date_obj = datetime.strptime(item['date'], "%b %d, %Y")
        
        # Get year-month key
        month_key = f"{date_obj.year}-{date_obj.month:02d}"
        
        monthly_groups[month_key].append((date_obj, item))
    
    # Get the last trading day from each month
    result = []
    for month_key in sorted(monthly_groups.keys()):
        month_data = monthly_groups[month_key]
        # Sort by date and take the last one (most recent in the month)
        month_data.sort(key=lambda x: x[0])
        last_trading_day = month_data[-1][1]  # Get the data item
        result.append(last_trading_day)
    
    return result

def fetch_company_info(query: str):
    """
    Scrapes company lookup information from Yahoo Finance based on a query.
    Utilizes Selenium to handle dynamic content loading.

    Args:
        query: The ticker symbol or company name to search for.

    Returns:
        A list of dictionaries containing information about matching companies.
    """
    url = f"https://finance.yahoo.com/lookup/?s={query}"

    driver = setup_driver()
    companies_data = []

    try:
        driver.get(url)
        wait = WebDriverWait(driver, 30)

        # Wait for the table to load
        table = wait.until(EC.presence_of_element_located((By.XPATH, '//table[@data-testid="table-container"]')))
        thead = table.find_element(By.TAG_NAME, 'thead')
        header_row = thead.find_element(By.TAG_NAME, 'tr')
        headers = [th.text.strip() for th in header_row.find_elements(By.TAG_NAME, 'th')]

        # Mapping headers to keys
        header_to_key_map = {
            "Symbol": "ticker",
            "Name": "name",
            "Last Price": "last_price",
            "Sector / Category": "sector_category",
            "Type": "type",
            "Exchange": "exchange"
        }
        keys = [header_to_key_map.get(h, h.lower().replace(' ', '_').replace('/', '_')) for h in headers]

        # Extract rows
        tbody = table.find_element(By.TAG_NAME, 'tbody')
        rows = tbody.find_elements(By.TAG_NAME, 'tr')
        for row in rows:
            cells = row.find_elements(By.TAG_NAME, 'td')
            if len(cells) != len(keys):
                continue
            company = {}
            for key, cell in zip(keys, cells):
                entry = cell.text.strip()
                if entry == "--":
                    company[key] = None
                else:
                    company[key] = entry
            companies_data.append(company)
        
        driver.quit()

        return companies_data

    except Exception as e:
        print(f"An error occurred: {e}")


def fetch_screener_balance_sheet(ticker: str, statement_type: str):
    """
    Fetches the balance sheet data from Screener.in for the given ticker.
    Tries one URL based on the provided type, and if the table is empty (i.e., contains no numeric data),
    it automatically tries the alternative URL.
    Returns a pandas DataFrame if successful.
    Raises an exception if any error occurs.
    """
    # Define both URLs.
    standalone_url = f"https://www.screener.in/company/{ticker}/#balance-sheet"
    consolidated_url = f"https://www.screener.in/company/{ticker}/consolidated/#balance-sheet"

    # Set the order based on the provided type.
    if statement_type == 'standalone':
        urls_to_try = [standalone_url, consolidated_url]
    elif statement_type == 'consolidated':
        urls_to_try = [consolidated_url, standalone_url]
    else:
        raise Exception("Invalid type")

    last_error = None

    # Try each URL in order.
    for url in urls_to_try:
        driver = setup_driver()
        try:
            page_source = load_page_with_expansion(url, driver)
            soup = BeautifulSoup(page_source, 'html.parser')

            # Look for the balance sheet section.
            table_section = soup.find("section", {"id": "balance-sheet"})
            if not table_section or not contains_numeric_data(table_section):
                raise Exception(
                    f"Balance sheet data not found or empty for {ticker.upper()} in URL: {url}")

            if table_section:
                sub_text_elem = table_section.find('p', class_='sub')
                if sub_text_elem:
                    # "Consolidated Figures in Rs. Crores / View Standalone"
                    full_text = sub_text_elem.get_text(strip=True)
                    # Split by '/' to extract the consolidated figures part.
                    currency_candidate = full_text.split('/')[0].strip()
                    currency = currency_candidate
                else:
                    currency = "N/A"
            else:
                currency = "N/A"

            # Extract headers.
            headers = [header.text.strip()
                       for header in table_section.find_all("th")]
            if not headers:
                raise Exception("No headers found in the balance sheet table.")

            # Extract rows.
            rows = []
            for row in table_section.find_all("tr")[1:]:
                cols = [col.text.strip() for col in row.find_all("td")]
                if cols:
                    rows.append(cols)
            if not rows:
                raise Exception(
                    f"No rows found for {ticker.upper()} in URL: {url}")

            driver.quit()
            df = pd.DataFrame(rows, columns=headers)
            return df, currency, url

        except Exception as e:
            last_error = e
            driver.quit()
            raise Exception(f"Error fetching balance sheet data from Screener for {ticker}: {last_error}")


def fetch_screener_cashflow_results(ticker: str, statement_type: str):
    """
    Scrapes the quarterly cash flow data for a given company from Screener.in.
    Tries one URL based on the provided type, and if the table is empty (i.e. contains no numeric data),
    it automatically tries the alternative URL.
    Returns a pandas DataFrame if successful.
    Raises an exception if any error occurs.
    """
    # Define both URLs.
    standalone_url = f"https://www.screener.in/company/{ticker}/#cash-flow"
    consolidated_url = f"https://www.screener.in/company/{ticker}/consolidated/#cash-flow"

    # Choose the order based on the provided type.
    if statement_type == 'standalone':
        urls_to_try = [standalone_url, consolidated_url]
    elif statement_type == 'consolidated':
        urls_to_try = [consolidated_url, standalone_url]
    else:
        raise Exception("Invalid type")

    last_error = None

    # Loop through each URL in order.
    for url in urls_to_try:
        driver = setup_driver()
        try:
            page_source = load_page_with_expansion(url, driver)
            soup = BeautifulSoup(page_source, 'html.parser')
            # Look for the Cash Flow section.
            table_section = soup.find("section", {"id": "cash-flow"})
            if not table_section or not contains_numeric_data(table_section):
                raise Exception(
                    f"Cash Flow data not found or empty for {ticker.upper()} in URL: {url}")

            if table_section:
                sub_text_elem = table_section.find('p', class_='sub')
                if sub_text_elem:
                    # "Consolidated Figures in Rs. Crores / View Standalone"
                    full_text = sub_text_elem.get_text(strip=True)
                    # Split by '/' to extract the consolidated figures part.
                    currency_candidate = full_text.split('/')[0].strip()
                    currency = currency_candidate
                else:
                    currency = "N/A"
            else:
                currency = "N/A"

            # Extract headers.
            headers = [header.text.strip()
                       for header in table_section.find_all("th")]
            if not headers:
                raise Exception("No headers found in the Cash Flow table.")

            # Extract rows.
            rows = []
            for row in table_section.find_all("tr")[1:]:
                cols = [col.text.strip() for col in row.find_all("td")]
                if cols:
                    rows.append(cols)
            if not rows:
                raise Exception(
                    f"No rows found for {ticker.upper()} in URL: {url}")

            driver.quit()
            df = pd.DataFrame(rows, columns=headers)
            return df, currency, url

        except Exception as e:
            last_error = e
            driver.quit()
            raise Exception(f"Error fetching cash flow data from Screener for {ticker}: {last_error}")


def fetch_screener_income_and_summary_results(ticker: str, statement_type: str):
    """
    Fetches the profit & loss (income statement) and summary data from Screener.in for the given ticker.
    Tries one URL based on the provided type, and if the table is empty or invalid,
    it automatically tries the alternative URL.
    Returns a dictionary with keys:
       - "profit_loss": a pandas DataFrame of the Profit & Loss table.
       - "summary": a pandas DataFrame of the summary metrics.
    Raises an exception if any error occurs.
    """
    # Define both URLs.
    standalone_url = f"https://www.screener.in/company/{ticker}/#profit-loss"
    consolidated_url = f"https://www.screener.in/company/{ticker}/consolidated/#profit-loss"

    # Determine the order to try based on the provided type.
    if statement_type == 'standalone':
        urls_to_try = [standalone_url, consolidated_url]
    elif statement_type == 'consolidated':
        urls_to_try = [consolidated_url, standalone_url]
    else:
        raise Exception("Invalid type")

    last_error = None

    # Try each URL in order.
    for url in urls_to_try:
        driver = setup_driver()
        try:
            page_source = load_page_with_expansion(url, driver)
            soup = BeautifulSoup(page_source, 'html.parser')

            # --- Extract Profit & Loss Data ---
            table_section = soup.find("section", {"id": "profit-loss"})
            if not table_section or not contains_numeric_data(table_section):
                raise Exception(
                    f"Profit & Loss data not found or table is empty for {ticker.upper()} in URL: {url}")

            if table_section:
                sub_text_elem = table_section.find('p', class_='sub')
                if sub_text_elem:
                    # "Consolidated Figures in Rs. Crores / View Standalone"
                    full_text = sub_text_elem.get_text(strip=True)
                    # Split by '/' to extract the consolidated figures part.
                    currency_candidate = full_text.split('/')[0].strip()
                    currency = currency_candidate
                else:
                    currency = "N/A"
            else:
                currency = "N/A"

            # Extract headers (handle multi-row header if necessary).
            headers = []
            header_rows = table_section.find_all("tr")
            for header_row in header_rows:
                header_cols = header_row.find_all("th")
                if header_cols:
                    headers = [col.get_text(strip=True) for col in header_cols]
                    break
            if not headers:
                raise Exception("No headers found in the Profit & Loss table.")

            # Extract data rows.
            rows = []
            for row in table_section.find_all("tr")[1:]:
                cols = [col.get_text(strip=True) for col in row.find_all("td")]
                if len(cols) == len(headers):
                    rows.append(cols)
            if not rows or all(not re.search(r'\d+', cell) for row in rows for cell in row):
                raise Exception("No meaningful Profit & Loss data found.")

            # Adjust headers if necessary.
            if rows and len(rows[0]) != len(headers):
                headers = [f"Column {i+1}" for i in range(len(rows[0]))]

            profit_loss_df = pd.DataFrame(rows, columns=headers)

            # --- Extract Summary Data ---
            summary_data = []
            for box in soup.find_all("table", class_="ranges-table"):
                title_tag = box.find("th")
                if not title_tag:
                    continue
                title = title_tag.get_text(strip=True)
                entries = box.find_all("tr")[1:]  # Skip the title row.
                for entry in entries:
                    tds = entry.find_all("td")
                    if len(tds) < 2:
                        continue
                    label = tds[0].get_text(strip=True)
                    value = tds[1].get_text(strip=True)
                    # Only include entries with numeric data.
                    if re.search(r'-?\d+(\.\d+)?%?', value):
                        summary_data.append({"Category": title, "Metric": label, "Value": value})

            summary_df = pd.DataFrame(summary_data) if summary_data else pd.DataFrame()

            driver.quit()

            return {"profit_loss": profit_loss_df, "summary": summary_df, "currency": currency, "source": url}

        except Exception as e:
            last_error = e
            driver.quit()
            raise Exception(f"Error fetching profit & loss data from Screener for {ticker}: {last_error}")
