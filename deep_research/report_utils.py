import json
from datetime import datetime, timezone
from .logging_utils import log_function
from .prompts import SYSTEM_PROMPT_TOPIC, SYSTEM_PROMPT_PARTIAL_REPORT, SYSTEM_PROMPT_FINAL_SECTIONS_UPDATED, SYSTEM_PROMPT_REPORT_GENERATION_ENHANCED, SYSTEM_PROMPT_TOPIC_SECTION, SYSTEM_PROMPT_TOPIC_SECTION_ENHANCED
import litellm
from litellm import acompletion, completion
from deep_research.schema import TopicStructure, ReportSections
from typing import Optional, List, Dict, Any, Type


@log_function
async def generate_topic_structure(query_content: str, sof_content: str, at_content: str, flat_string: str, user_request_content:str = None) -> List[Dict]:
    current_dt = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    prompt = (
        f"Current Date and Time: {current_dt}\n\n"
        f"Research Query: {query_content}\n\n"
        f"Subject of Focus: {sof_content}\n\n"
        f"Analysis Type: {at_content}\n\n"
        f"Search Results:\n{flat_string}\n\n"
    )
    if user_request_content:
        prompt += f"User Request: {user_request_content.strip()}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_TOPIC},
        {"role": "user", "content": prompt}
    ]
    try:
        response = await acompletion(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.4,
            response_format=TopicStructure
        )
        raw_output = response.choices[0].message.content
        parsed_output = json.loads(raw_output)
        usage_tokens = response.get("usage")
        usage_dict = {
                        "input_tokens": usage_tokens.prompt_tokens,
                        "output_tokens": usage_tokens.completion_tokens,
                        "total_tokens": usage_tokens.total_tokens
                    }
        return parsed_output, usage_dict
    except Exception as e:
        # print("Error generating topic structure:", e)
        # return []
        # raise ValueError("Error generating topic structure:", e)
        raise RuntimeError(f"Error generating topic structure:: {e}")
    


@log_function
async def generate_topic_report(user_query: str, topic: str, subtopics: List[str], content: str, covered_topics: List[str] = None, user_request_content:str = None) -> str:
    """
    Generates a report section for a single topic. For each subtopic, a comprehensive paragraph is created
    using the provided extracted content.
    """
    
    prompt = f"Research Query: {user_query}\n\n"
    prompt += f"## Topic: {topic}\n\n"
    subtopics_str = "\n".join(subtopics)
    prompt += f"Subtopics:\n{subtopics_str}\n\n"
    prompt += f"Extracted Data:\n\n{content}"
    previous_output_str = ""
    # if previous_output:
    #     previous_output_str = previous_output[-1]
    #     prompt = f"Previous Output:\n{previous_output_str}\n\n" + prompt
    if covered_topics:
        prompt = f"Previously Covered Topics: {', '.join(covered_topics)}\n\nIMPORTANT: Do not repeat information already covered in the above topics. Focus only on new, unique information for the current topic. Keep the section title before the content of that particular section\n\n" + prompt
    # if previous_output:
    #     covered_topics = []
    #     for prev_report in previous_output:
    #         # Extract just the main topic heading from previous reports
    #         lines = prev_report.split('\n')
    #         for line in lines:
    #             if line.startswith('## '):
    #                 covered_topics.append(line.replace('## ', '').strip())
    #                 break
        
    #     if covered_topics:
    #         prompt = f"Previously Covered Topics: {', '.join(covered_topics)}\n\nIMPORTANT: Do not repeat information already covered in the above topics. Focus only on new, unique information for the current topic.\n\n" + prompt
    #         print("here are the covered topics ",covered_topics)
    if user_request_content:
        prompt += f"User Request: {user_request_content.strip()}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_TOPIC_SECTION_ENHANCED},
        {"role": "user", "content": prompt}
    ]
    try:
        response = await acompletion(
            model="gpt-4.1-mini",
            messages=messages,
            temperature=0.4,
        )
        raw_output = response.choices[0].message.content.strip()
        usage_tokens = response.get("usage")
        usage_dict = {
                        "input_tokens": usage_tokens.prompt_tokens,
                        "output_tokens": usage_tokens.completion_tokens,
                        "total_tokens": usage_tokens.total_tokens
                    }
        
        return raw_output, usage_dict
    except Exception as e:
        # print("Error generating topic report:", e)
        # return ""
        # raise ValueError("Error generating topic report:", e)
        raise RuntimeError(f"Error generating topic report:: {e}") from e


@log_function
async def generate_final_report(user_query: str, topics: List[str], partial_report_str: str) -> ReportSections:
    """
    Instead of generating the entire final report, this function now takes the combined report content
    and instructs the LLM to extract only the Title, Introduction, Executive Summary, and Conclusion.
    The output is parsed into a ReportSections object.
    """
    topics_str = "\n".join(topics)
    # complete_report = (
    #     f"User Query: {user_query}\n\n"
    #     f"Topics Covered: {topics_str}\n\n"
    #     f"Compiled Topic Reports:\n{partial_report_str}"
    # )
    # prompt = (
    #     f"Complete Report:\n{complete_report}\n\n"
    #     "Please extract and generate the following sections: Title, Introduction, Executive Summary, and Conclusion. "
    #     "Each section should be clearly labeled and output as JSON with the keys: title, introduction, executiveSummary, conclusion."
    # )
    
    prompt = (
        f"User Query: {user_query}\n\n"
        f"Research Topics: {topics_str}\n\n"
        f"Detailed Research Data:\n{partial_report_str}\n\n"
        "Create ONE unified report that naturally integrates all research topics throughout the sections. "
        "Do NOT create separate sections for each topic. Instead, weave all topics together where they naturally fit. "
        "Write as a single, cohesive deep analysis that flows logically from introduction through conclusion. "
        "Topics should be mentioned and analyzed where most relevant within each section. "
        "Output as JSON with keys: title, overview and  conclusion."
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_FINAL_SECTIONS_UPDATED},
        {"role": "user", "content": prompt}
    ]
    try:
        response = litellm.completion(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3,
            response_format=ReportSections
        )

        final_sections_raw = json.loads(response.choices[0].message.content)
        # Parse the JSON response into the ReportSections model
        report_sections = ReportSections(**final_sections_raw)
        usage_tokens = response.get("usage")
        usage_dict = {
                        "input_tokens": usage_tokens.prompt_tokens,
                        "output_tokens": usage_tokens.completion_tokens,
                        "total_tokens": usage_tokens.total_tokens
                    }
        return report_sections, usage_dict
    except Exception as e:
        # print("Error generating Final sections:", e)
        # raise ValueError("Error generating Final sections:", e)
        raise RuntimeError(f"Error generating Final sections:: {e}") from e
        # return ReportSections(title="", introduction="", executiveSummary="", conclusion="")