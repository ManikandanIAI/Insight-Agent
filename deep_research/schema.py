from pydantic import BaseModel, Field
from typing import List

class TopicDictStructure(BaseModel):
    Topic: str = Field(..., description="The main topic as a string.")
    Subtopics: List[str] = Field(..., description="A list of up to three related subtopics as strings.")

class TopicStructure(BaseModel):
    log: List[TopicDictStructure] = Field(..., description="List of topic dictionaries.")
    summary: str = Field(..., description="Summary from the search results.")

class SearchableQueries(BaseModel):
    queries: List[str] = Field(..., description="List of searchable queries.")

class RelevanceResponse(BaseModel):
    result: List[str] = Field(..., description="List of unique link IDs (e.g., ['Link_1', 'Link_2']) corresponding to relevant entries.", strict=True)
    summary: str = Field(..., description="Concise summary of the content related to the provided link IDs.", strict=True)

class ReportSections(BaseModel):
    title: str
    overview: str
    conclusion: str
