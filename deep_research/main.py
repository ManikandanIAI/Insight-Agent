# main.py

import json
import re
from datetime import datetime
from IPython.display import Markdown, display

from deep_research.logging_utils import get_log_file_path, final_output_file_path, append_log_to_txt
from llm_utils import process_query
from search_utils import tavily_search, generate_searchable_queries_from_topic_structure, store_extracted_content
from report_utils import generate_topic_structure, generate_topic_report, generate_final_report
from schema import ReportSections



def main():
    global markdown_text
    logs_file_path = get_log_file_path()
    output_file_path = final_output_file_path()
    # Get the initial user query.
    user_query = input("Enter your query: ")
    append_log_to_txt(f"User query input: {user_query}", "main", logs_file_path)
    user_query += f"Original Query: {user_query}\n"
    current_feedback = None
    cross_questions_asked = False

    search = True

    while True:
        output = process_query(user_query, search)
        append_log_to_txt(f"Processed query output: {output}", "process_query_loop", logs_file_path)

        # Use regular expressions to capture the various tags.
        ask_match = re.search(r'<ask>(.*?)</ask>', output, re.IGNORECASE | re.DOTALL)
        # cq_match = re.search(r'<cq>(.*?)</cq>', output, re.IGNORECASE | re.DOTALL)
        research_query_match = re.search(r'<researchQuery>(.*?)</researchQuery>', output, re.IGNORECASE | re.DOTALL)
        sof_match = re.search(r'<SOF>(.*?)</SOF>', output, re.IGNORECASE | re.DOTALL)
        at_match = re.search(r'<AT>(.*?)</AT>', output, re.IGNORECASE | re.DOTALL)
        search_instruction_match = re.search(r'<searchInstruction>(.*?)</searchInstruction>', output, re.IGNORECASE | re.DOTALL)
        format_instruction_match = re.search(r'<formatInstruction>(.*?)</formatInstruction>', output, re.IGNORECASE | re.DOTALL)

        if ask_match:
            search = False
            ask_content = ask_match.group(1).strip()
            print("\nClarification Required:")
            print(ask_content)
            current_feedback = input("Enter additional feedback (or leave blank if none): ").strip() or None
            append_log_to_txt(f"Clarification asked: {ask_content} | User Feedback received: {current_feedback}",
                                "feedback", logs_file_path)
            user_query += f"Clarification question: {ask_content}\nUser response: {current_feedback}\n\n"
        else:
            # No <ask> or <cq> tag detected; proceed with the final output.
            print("\nFinal Output:")
            research_query = research_query_match.group(1).strip() if research_query_match else ""
            sof_content = sof_match.group(1).strip() if sof_match else ""
            at_content = at_match.group(1).strip() if at_match else ""
            search_instruction = search_instruction_match.group(1).strip() if search_instruction_match else ""
            format_instruction = format_instruction_match.group(1).strip() if format_instruction_match else ""

            print(f"Research Query: {research_query}")
            print(f"Subject of Focus: {sof_content}")
            print(f"Analysis Type: {at_content}")
            print(f"Search Instruction: {search_instruction}")
            print(f"Format Instruction: {format_instruction}")


            # Use the refined research query to perform a Tavily search.
            results = tavily_search(research_query)
            flat_string = "\n\n".join(
                f"Title: {item['title']}\nURL: {item['url']}\nContent: {item['content']}"
                for item in results
            )
            append_log_to_txt(f"Search results:\n{flat_string}", "tavily_search", logs_file_path)

            # Further processing: generate topic structure, topic reports, and a final report.
            topic_structure_output = generate_topic_structure(research_query, sof_content, at_content, flat_string, search_instruction)
            topic_list = topic_structure_output.get("log", []) if isinstance(topic_structure_output, dict) else []
            append_log_to_txt(f"Generated topic structure: {topic_list}", "generate_topic_structure", logs_file_path)

            if topic_list:
                partial_report = []  # Initialize partial report.
                for item in topic_list:
                    content_dict = {}
                    print(item)
                    queries = generate_searchable_queries_from_topic_structure(item, research_query, sof_content, at_content, search_instruction)
                    temp_dict = store_extracted_content(queries.get("queries"))
                    if temp_dict:
                        content_dict.update(temp_dict)
                        item['info_extract'] = True
                        item['links'] = list(temp_dict.keys())
                    else:
                        item['info_extract'] = False
                    if item.get("info_extract") is True:
                        content = ""
                        for key, value in temp_dict.items():
                            content += f"Link: {key}\nContent: {value}\n\n"
                        topic_report = generate_topic_report(item.get("Topic"), item.get("Subtopics"), content, partial_report, format_instruction)
                        partial_report.append(topic_report)
                if partial_report:
                    partial_report_str = "\n\n".join(partial_report)
                    final_sections = generate_final_report(user_query, [item.get("Topic") for item in topic_list], partial_report_str)

                    markdown_text = (
                        f"# **{final_sections.title}**\n\n"
                        f"## **Introduction:**\n"
                        f"{final_sections.introduction}\n\n"
                        f"## **Executive Summary:**\n"
                        f"{final_sections.executiveSummary}\n\n"
                        f"{partial_report_str}\n\n"
                        f"## **Conclusion:**\n"
                        f"{final_sections.conclusion}"
                    )
                    display(Markdown(markdown_text))
                else:
                    print("No partial report generated")
            else:
                print("No topics were extracted from the search results.")

            # Log final details and write them to file.
            details = {
                "researchQuery": research_query,
                "SOF": sof_content,
                "AT": at_content,
                "searchInstruction": search_instruction,
                "format_instruction": format_instruction,
                "searchResults": results,
                "topicStructure": topic_list,
            }
            append_log_to_txt(json.dumps(details, indent=2), "final_details", output_file_path)
            with open(final_output_file_path, "w") as f:
                json.dump(details, f, indent=2)
            break

if __name__ == "__main__":
    main()
