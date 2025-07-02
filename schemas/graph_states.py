from typing import Annotated, Sequence, Optional, List
from datetime import datetime
from langchain_core.messages import BaseMessage
from typing_extensions import TypedDict
from langgraph.graph import add_messages


class InsightAgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    manager_instructions: Annotated[Sequence[BaseMessage], add_messages]
    previous_messages: List[BaseMessage]
    realtime_info: bool
    currency_rates: str
    file_path: Optional[str]
    file_content: Optional[str]
    user_query: str
    query_tag: str
    is_relevant_query: bool
    required_information: str
    initial_info: str
    reasoning : bool
    subtasks: list
    task_list: list
    current_task: dict
    final_response: str
    validation_result: Optional[dict]
    feedback_cycle: int
    human_intervention: Optional[str]
    user_metadata : Optional[str]
    research_plan: Optional[dict]
    doc_ids: Optional[list]


