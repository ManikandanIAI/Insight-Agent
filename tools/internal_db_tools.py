from langchain_core.tools import tool, BaseTool
from pydantic import BaseModel, Field
from typing import List, Literal, Type
from utils import pretty_format
from schemas.tool_structured_input import DatabaseSearchSchema
from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient
from dotenv import dotenv_values
import os
import json
from langchain_community.vectorstores import Qdrant

env_vars = dotenv_values('.env')
openai_api_key = env_vars.get('OPENAI_API_KEY')
QDRANT_CLIENT_URL = env_vars.get('QDRANT_CLIENT_URL')

class DatabaseSearchTool(BaseTool):
    name: str = "db_search_tool"
    description: str = "Use this tool to search internal database, which contains textual information related to companies/industries, market/news or finance. *Use this tool only once*."
    args_schema: Type[BaseModel] = DatabaseSearchSchema

    def _run(self, query: str):
        try:
            # DB search logic
            return "No Information Found."
        except Exception as e:
            error_msg = f"Error in searching internal database: {str(e)}"
            return error_msg


class SearchArgs(BaseModel):
    query: str = Field(description="Search query string")
    doc_ids: list = Field(description="List of document IDs for filtering documents")
    explanation: str = Field(description="Provide short reasoning for calling this tool.")

class SearchAuditDocumentsTool(BaseTool):
    name: str = "search_audit_documents"
    description: str = (
        "Perform a similarity search on the 'file_storage' Qdrant collection. "
        "Returns up to 5 document snippets as JSON. Filters by provided document IDs."
    )
    args_schema: type[BaseModel] = SearchArgs
    
    def _run(self, query: str, doc_ids: list, explanation: str = None) -> str:
        qdrant = QdrantClient(host=QDRANT_CLIENT_URL, port=6333)
        embeddings = OpenAIEmbeddings(api_key=openai_api_key)
        try:
            store = Qdrant(client=qdrant, collection_name="file_storage", embeddings=embeddings)
            docs_with_scores = []

            for doc_id in doc_ids:
                docs_with_score = store.similarity_search_with_score(query=query, k=5, filter={"file_id": doc_id})
                docs_with_scores.extend(docs_with_score)

            results = [
                {
                    "content": doc.page_content, 
                    "filename": doc.metadata.get("filename"), 
                    "file_id": doc.metadata.get("file_id"),
                    "confidence_score": float(score)
                } 
                for doc, score in docs_with_scores
            ]
            return json.dumps(results)
        except Exception as e:
            print(e)
            return json.dumps([]) 


search_qdrant_tool = SearchAuditDocumentsTool()
# db_search_tool = DatabaseSearchTool()
