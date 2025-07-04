import requests
import json
import random
from langchain_core.tools import tool, BaseTool
from typing import List, Literal, Type, Dict
import time
import os 
from pydantic import BaseModel, Field
from schemas.tool_structured_input import GeocodeInput

from smolagents import LiteLLMModel, CodeAgent
from dotenv import load_dotenv
from graph_tool_system_prompt import SYSTEM_PROMPT


def extract_markdown_tables_from_string(md_content):
    """Extracts all markdown tables from a markdown string.

    This function scans the provided markdown string and extracts any tables
    written in GitHub Flavored Markdown format. A table is identified by a header
    row containing '|' and a separator line immediately following it (with '-', ':' and '|').
    The function returns each found table as a string (including header, separator, and rows).

    Args:
        md_content (str): The markdown content as a string.

    Returns:
        list of str: A list where each element is a string representation of a markdown table
        found in the string, preserving line breaks within each table.
    """
    tables = []
    current_table = []
    in_table = False

    # Split input string into lines
    lines = md_content.splitlines()

    for i, line in enumerate(lines):
        line_strip = line.strip()

        # Table header row: must contain '|' and not only dashes/spaces
        if '|' in line_strip and not set(line_strip.replace('|', '').replace(' ', '')).issubset({'-', ':'}):
            # Check next line for separator
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if (
                    '|' in next_line
                    and set(next_line.replace('|', '').replace(' ', '')).issubset({'-', ':'})
                    and len(next_line.replace('|', '').replace(' ', '')) >= 3
                ):
                    # Start of a new table
                    in_table = True
                    current_table.append(line.rstrip('\n'))
                    continue

        # If we're in a table, append lines
        if in_table:
            if line_strip == '' or not '|' in line_strip:
                # End of table
                if current_table:
                    tables.append('\n'.join(current_table))
                current_table = []
                in_table = False
            else:
                current_table.append(line.rstrip('\n'))

    # Handle last table if string ends with a table
    if current_table:
        tables.append('\n'.join(current_table))

    return tables


openai_api_key = os.getenv("OPENAI_API_KEY")

model = LiteLLMModel(
    model_id="openai/gpt-4.1-mini-2025-04-14",
    temperature=0.1,
    api_key=openai_api_key
)

agent = CodeAgent(
    tools=[],
    model=model, 
    additional_authorized_imports=['numpy', 'plotly', 'random', 'plotly.express', 'plotly.io', 'plotly.graph_objects', 'plotly.figure_factory', 'plotly.subplots', 'textwrap', 'helper_functions'],
    max_steps=3,
)


def generate_graphs(md_content):
    tables = extract_markdown_tables_from_string(md_content)
    
    output_dir = "output_graphs/"
    os.makedirs(output_dir, exist_ok=True)

    results = []

    
    for y, table in enumerate(tables, start=1):
        
        INPUT_PROMPT = f"""
        The table is listed below:

        \n{table}\n

        """

        result = agent.run(SYSTEM_PROMPT + INPUT_PROMPT)

        if "```python" not in result:
            results.append(result)
        else:
            results.append("NO GRAPH GENERATED!.")


    
    # print(f"Final return = {json.dumps(results)}")
    return json.dumps(results)



class GraphGenToolInput(BaseModel):
    table: str = Field(description="Provide a table in markdown format to create the visualization chart.")


class GraphGenTool(BaseTool):
    name: str = "graph_generation_tool"
    description: str = """
    Use this tool to generate a visualization chart by providing the table in markdown format. The tool returns the chart_title and chart_url of the generated chart.
    """
    args_schema: Type[BaseModel] = GraphGenToolInput

    def _run(self, table: str) -> str:

        # print(f"---TOOL CALL: graph_generation_tool \n --- \n Table: \n{table}\n --- \n")

        output_string = generate_graphs(table)

        return output_string

graph_generation_tool = GraphGenTool()
graph_tool_list = [graph_generation_tool]