from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from schemas.graph_states import InsightAgentState
from agents.db_search_agent import DBSearchAgent
from agents.intent_detector import IntentDetector
from agents.validation_agent import ValidationAgent
from agents.manager_agent import ManagerAgent
from agents.web_search_agent import WebSearchAgent
from agents.social_media_agent import SocialMediaAgent
from agents.finance_data_agent import FinanceDataAgent
from agents.coding_agent import CodingAgent
from agents.response_generator_agent import ReportGenerationAgent
from agents.planner_agent import PlannerAgent
from agents.executor_agent import ExecutorAgent
from agents.utils import task_router_node
from agents.sentiment_analysis_agent import SentimentAnalysisAgent
from agents.data_comparison_agent import DataComparisonAgent
from agents.map_agent import MapAgent
from IPython.display import Markdown, Image, display
import os


class InsightAgentGraph:
    def __init__(self):
        self.state = InsightAgentState
        # self.checkpointer = MemorySaver()
        self.agents = self._initialize_agents()
        self.graph = self._create_graph()
        

        self._setup_folders()

    def _setup_folders(self):
        directories = ["public", "graph_logs", "external_data"]

        for directory in directories:
            if not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)
                print(f"Created directory: {directory}")

    def _initialize_agents(self):
        self.intent_detector = IntentDetector()
        self.db_search_agent = DBSearchAgent()
        self.planner_agent = PlannerAgent()
        self.executor_agent = ExecutorAgent()
        self.task_router = task_router_node

        self.manager_agent = ManagerAgent()

        self.web_search_agent = WebSearchAgent()
        self.social_media_agent = SocialMediaAgent()
        self.finance_data_agent = FinanceDataAgent()
        self.coding_agent = CodingAgent()

        self.sentiment_analysis_agent = SentimentAnalysisAgent()
        self.data_comparison_agent = DataComparisonAgent()

        self.map_agent = MapAgent()
        self.response_generator_agent = ReportGenerationAgent()

        self.validation_agent = ValidationAgent()

    def _create_graph(self):
        graph = StateGraph(self.state)
        graph.add_node("Query Intent Detector", self.intent_detector)
        graph.add_node("DB Search Agent", self.db_search_agent)
        graph.add_node("Planner Agent", self.planner_agent)
        graph.add_node("Manager Agent", self.manager_agent)
        graph.add_node("Executor Agent", self.executor_agent)
        graph.add_node("Task Router", self.task_router)
        graph.add_node("Web Search Agent", self.web_search_agent)
        graph.add_node("Social Media Scrape Agent", self.social_media_agent)
        graph.add_node("Finance Data Agent", self.finance_data_agent)
        graph.add_node("Sentiment Analysis Agent", self.sentiment_analysis_agent)
        graph.add_node("Data Comparison Agent", self.data_comparison_agent)
        graph.add_node("Coding Agent", self.coding_agent)
        graph.add_node("Map Agent", self.map_agent)
        graph.add_node("Response Generator Agent", self.response_generator_agent)
        graph.add_node("Validation Agent", self.validation_agent)

        graph.add_edge(START, "Query Intent Detector")
        graph.add_edge("Planner Agent", "Executor Agent")
        graph.add_edge("Executor Agent", "Task Router")

        graph.add_edge("Sentiment Analysis Agent", "Task Router")
        graph.add_edge("Data Comparison Agent", "Task Router")
        
        graph.add_edge("Response Generator Agent", END)

        insight_graph = graph.compile(checkpointer=MemorySaver())

        return insight_graph

    

    def get_mermaid_graph(self):
        return self.graph.get_graph().draw_mermaid()

    def get_graph(self):
        return self._create_graph()

    def get_mermaid_png(self):
        return self.graph.get_graph().draw_mermaid_png()

