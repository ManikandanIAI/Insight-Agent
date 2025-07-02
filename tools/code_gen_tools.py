from schemas.tool_structured_input import CodeExecutionToolInput
from utils import pretty_format
import ast
import sys
import io
from IPython.display import display, HTML
import sklearn
import plotly.io as pio
import plotly.graph_objects as go
import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from langchain_core.tools import tool, BaseTool
from pydantic import BaseModel, Field
from typing import List, Dict, Literal, Annotated, Optional, Sequence, Union, Any, Iterable, Type
import matplotlib
matplotlib.use('Agg')


class CodeExecutionTool(BaseTool):
    name: str = "code_execution_tool"
    description: str = """A tool for executing Python code dynamically and maintaining execution context.
Useful for running computations, defining functions, and managing variables across multiple code executions.

Input should be a string of valid Python code.
Outputs only the print results or any errors.
"""

    args_schema: Type[BaseModel] = CodeExecutionToolInput

    execution_context: Dict[str, Any] = {}
    cell_history: list = []

    def _run(self, code: str, explanation: str) -> str:
        try:
            original_stdout = sys.stdout
            output_capture = io.StringIO()
            sys.stdout = output_capture

            try:
                if hasattr(sys.stdin, 'buffer'):
                    sys.stdin.buffer.flush()

                output_capture.truncate(0)
                output_capture.seek(0)

                parsed = ast.parse(code)

                if parsed.body and isinstance(parsed.body[-1], ast.Expr):
                    exec(compile(ast.Module(
                        body=parsed.body[:-1], type_ignores=[]), '<string>', 'exec'), self.execution_context)

                    last_expr = compile(ast.Expression(
                        parsed.body[-1].value), '<string>', 'eval')
                    expr_value = eval(last_expr, self.execution_context)

                    if expr_value is not None:
                        if isinstance(expr_value, (list, tuple, set)):
                            for element in expr_value:
                                print(element)
                        else:
                            print(expr_value)
                else:
                    exec(code, self.execution_context)

            finally:
                sys.stdout = original_stdout

            output = output_capture.getvalue().strip()

            result = {
                'output': output,
                'variables': list(self.execution_context.keys())
            }

            self.cell_history.append(result)

            return output

        except Exception as e:
            error_message = f"Error executing code: {str(e)}"
            return error_message

    def get_variable(self, var_name: str):
        return self.execution_context.get(var_name)


code_execution_tool = CodeExecutionTool()
