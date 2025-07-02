# text_utils.py

from .logging_utils import log_function
import re

@log_function
def _clean_text(text: str) -> str:
    """
    Cleans raw extracted text by removing extra whitespace, tabs, and redundant newlines.
    """
    try:
        text = re.sub(r'\n\s*\n', '\n', text)
        text = re.sub(r'\t+', ' ', text)
        text = text.strip()
        text = re.sub(r' +', ' ', text)
        return text
    except Exception as e:
        return f"Error cleaning text: {str(e)}"