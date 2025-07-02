from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Tuple, Dict


class IntentDetection(BaseModel):
    reject_query: bool = Field(
        description="Set to True ONLY if the **Latest User Query** is genuinely nonsensical, lacks any discernible topic/structure, contains foul/explicit language or dicriminative intent."
    )
    
    formatted_user_query: Optional[str] = Field(
        description="The **Latest User Query** as such. This field should be populated ONLY if `reject_query` is False."
    )
    query_tag: Optional[List[str]] = Field(
        description=(
            "Tags categorizing the 'formatted_user_query' by combining selections from core and subcategories. "
            "Populated only if `reject_query` is False. "
            "Core: Personal Finance, Corporate Finance, Investments, Markets, Company-Specific, Economic Indicators, Regulatory & Compliance, Risk Management, Financial Tools & Models, Products & Services. "
            "Sub: Comparative Analysis, Market Trends, Investment Strategies, Definitions & Education, Real-Time Data, Historical Data, Global Markets, Emerging Trends, Crisis & Events."
        )
    )
    query_intent: List[Literal['realtime', 'historical', 'factual', 'calculation', 'casual', 'definitions', 'translation', 'currency-conversion', 'analytical', 'inappropriate','other', 'incomplete', 'duplicate-query', 'general']] = Field(
        description=(
            "Specifies the primary intent of the **Latest User Query**. Populated only if `reject_query` is False. "
            "Options: 'realtime', 'historical', 'factual', 'calculation', 'general' (for general/financial context without specific data need), "
            "'casual' (For greetings, knowing each other, conversational, personal questions)"
            "'definitions' (if, to know the definitions of the financial terms.)"
            "'translation','currency-conversion' (for follow-ups on previous responses), "
            "'analytical' (for transformed queries seeking impact/analysis on real or hypothetical scenarios)."
            "'duplicate-query' (for repeated/previously-asked queries.)"
        )
    )
    response_to_user: Optional[str] = Field(
        description="Only reponse provided in this field is visisble to user. So use this field to communicate with user - ask question, provide response, etc."
    )


class DBSearchOutput(BaseModel):
    is_sufficient_info: bool = Field(
        description="Whether the information obtained from internal database is sufficient to answer the user question.")
    key_details_from_info: str = Field(default="No information available.",
                                       description="All the information extracted from the internal database regarding the user question.")


class Subtasks(BaseModel):
    task_name: str = Field(description="Unique name of the task")
    agent_name: str = Field(description="Name of the specialized agent")
    agent_task: str = Field(
        description="One line summary of task assigned to the agent")
    instructions: str = Field(
        description="Specific instructions for the agent based on user input")
    expected_output: str = Field(
        description="Expected output from the agent based on user input")
    # required_context: Optional[RequiredContext] = Field(description="Information addition to task details required to perform the task.")
    required_context: Optional[List[str]] = Field(
        description="List of task names whose output is required for current task")


# Response format for Planner Agent
class PlannerAgentOutput(BaseModel):
    subtasks: List[Subtasks] = Field(strict=True)


class TaskDetail(BaseModel):
    task_name: str = Field(description="Task name is same as task_1 , task_2 in research plan")
    agent_name: str = Field(description="Name of the specialized agent")
    agent_task: str = Field(
        description="The plan in a task of research plan")
    instructions: str = Field(
        description="Specific instructions for the agent based on user input")
    expected_output: str = Field(
        description="Expected output from the agent based on user input")
    # required_context: Optional[RequiredContext] = Field(description="Information addition to task details required to perform the task.")
    required_context: Optional[List[str]] = Field(
        description="List of task names whose output is required for current task")


# Response format for Executor Agent
class ExecutorAgentOutput(BaseModel):
    task_list: List[TaskDetail] = Field(strict=True)


# Updated ValidationFeedback schema
class ValidationFeedback(BaseModel):
    is_valid: Literal["Fully Correct Response", "Incorrect Response", "Partially Correct Response"] = Field(
        description="Whether the response is a complete answer, an incomplete answer, or wrong answer")
    feedback: str = Field(
        description="Constructive feedback if the response is insufficient")


class RelatedQueries(BaseModel):
    related_queries: Optional[List[str]] = Field(description="List of four queries.")


class HexagonLayerDateData(BaseModel):
    COORDINATES: List[float] = Field(min_items=2, max_items=2, description="The latitude and longitude of the given location. In the following format (latitude, longitude).")
    LOCATION_NAME: str = Field(description="Name of the marked location.")
    DATETIME: str = Field(description="Use ISO 8601 format yyyy-MM-ddTHH:mm:ss.SSSZ to record the datetime—for example,2025-04-24T12:34:56.789Z. If the time is omitted (not the entire timestamp), default only the time portion to 00:00:00.000 while keeping the full date, e.g. 2025-04-24T00:00:00.000Z. If the day is omitted, default only the day to 01 (keeping month, year, and time), e.g. 2025-04-01T12:34:56.789Z. If the month is omitted, default only the month and day to 01 (keeping year and time), e.g. 2025-01-01T12:34:56.789Z. If the year is omitted, leave the entire field empty. Make sure to get the year atleast.")
    NUMERICAL_DATA: float = Field(description="Numerical data that we need to show on the map")
    NUMERICAL_DATA_UNIT: str = Field(description="The unit of the numerical data that we need to show on the map")
    DESCRIPTION: str = Field(description="Write one sentence summary on the context of this location based on the user's query and summarize the results you obtained, be very specific, also include any important numerical informations.")
    
class SingleLayerResponse(BaseModel):    
    data: List[HexagonLayerDateData] = Field(description="Provide a list of visualization layers along with their data payloads. Your list must include 'HexagonLayer' entries—each representing a different timestamp.")


###########################################################################3333333

class TaskModel(BaseModel):
    plan: str
    completed: bool = False
    agent: Optional[str] = None

class TasksContainer(BaseModel):
    tasks: Dict[str, TaskModel]


