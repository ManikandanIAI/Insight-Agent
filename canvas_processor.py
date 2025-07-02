# document_processor.py
"""
Combined document processing module containing both extraction and LLM workflow functions.
This allows direct import without multiple dependencies.
"""

import re
import os
import tempfile
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_tavily import TavilySearch
from dotenv import load_dotenv
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel, Field

# Load environment variables
load_dotenv()

openai_api_key = os.getenv("OPENAI_API_KEY")

# ===== STEP 1: EXTRACT EDITABLE SECTION =====

def process_editable_section(filename: str, query: str):
    """
    Extracts the editable section and context from a file delimited by specific tags.

    This function reads the contents of a file, locates the section between
    `<!EDIT_START_CANVAS>` and `<!EDIT_END_CANVAS>` markers, and returns the leading
    context, the editable section, the trailing context, and the original query.

    Args:
        filename (str): Path to the input file to be processed.
        query (str): The query string to be returned as part of the output.

    Returns:
        tuple: A tuple containing:
            - leading_context (str or None): The text before the editable section,
              or None if the section is not found.
            - editable_section (str or None): The text within the editable section,
              or None if the section is not found.
            - trailing_context (str or None): The text after the editable section,
              or None if the section is not found.
            - query (str): The original query string.

    Prints:
        - The number of characters in the editable section if found.
        - A message if no editable section is found in the file.
    """
    pattern = r"(.*?)<!EDIT_START_CANVAS>(.*?)<!EDIT_END_CANVAS>(.*)"
    
    with open(filename, "r", encoding="utf-8") as f:
        read_data = f.read()

    match = re.match(pattern, read_data, re.DOTALL)
    
    if match:
        leading_context = match.group(1).strip()
        editable_section = match.group(2).strip()
        trailing_context = match.group(3).strip()

        print(f"Number of characters in editable_section: {len(editable_section)}")

        return leading_context, editable_section, trailing_context, query
    else:
        print("No editable section found in the file.")
        return None, None, None, query

# ===== STEP 2: LLM WORKFLOW =====

class OutputSchemaCanvasLLM(BaseModel):
    """
    The output schema for LLM processing
    """
    edited_text: str = Field(description="The modified text content based on user's query.")

SYSTEM_PROMPT = f"""
## Role

You are an advanced financial analyst with extensive experience in drafting, editing, and reviewing professional financial reports.

## Objective

Your task is to carefully edit the provided content according to the user's instructions, ensuring your output maintains accuracy, clarity, and financial reporting best practices. Use the context provided before and after the editable section to ensure seamless integration.

"""

def update_doc(leading_context, editable_section, trailing_context, query):
    """
    Modifies the editable section of a financial document based on a user query, ensuring context-aware and professionally formatted output.

    This function takes leading and trailing context from a document, along with an editable section and a user-provided query. It then formulates a prompt for a language model to revise the editable section according to the query while ensuring the edit is seamlessly integrated with the surrounding content and follows professional financial reporting standards.

    Args:
        leading_context (str): The text preceding the editable section in the document.
        editable_section (str): The specific section of the document to be edited.
        trailing_context (str): The text following the editable section in the document.
        query (str): The user's instruction or request for editing the section.

    Returns:
        str: The full document with the edited section, seamlessly integrated with the leading and trailing context.

    """

    # Get last 2000 characters of leading_context, if available
    leading_context_trimmed = leading_context[-2000:] if len(leading_context) > 2000 else leading_context

    # Get first 2000 characters of trailing_context, if available
    trailing_context_trimmed = trailing_context[:2000] if len(trailing_context) > 2000 else trailing_context

    INPUT_PROMPT = f"""
    ## Edit Request

    1. **User Query:** {query}

    2. **Section to Edit:** {editable_section}

    3. **Snippet of Preceding Context:** {leading_context_trimmed}

    4. **Snippet of Following Context:** {trailing_context_trimmed}

    ## Instructions

    - Revise the specified section based on the user's query.
    - Ensure the edit aligns with the overall context and maintains a professional tone suitable for a financial report.
    - **Output only the revised section.**
    - **Make sure your output is properly formatted in Markdown.**
    - Include appropriate white space (such as spaces and line breaks) to ensure clarity and readability, based on the context. For example, add extra space (use '\\n' before and after the edited portion if it is relevant) between the edited portion and the surrounding context so that the revision integrates smoothly and looks well-formatted.

    ## Tool you can use:

    tavily_search: use this if you want to search the internet to get any information you don't have from internet or to get any latest information
    """

    # Initialize the Model
    llm = ChatOpenAI(model="gpt-4.1-mini-2025-04-14", temperature=0.1, api_key=openai_api_key) 

    tavily_search_tool = TavilySearch(
        max_results=5,
        topic="general",
    )

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=INPUT_PROMPT)
    ]

    agent = create_react_agent(llm, [tavily_search_tool], response_format=OutputSchemaCanvasLLM)
    response = agent.invoke(input={"messages": messages})
    print("response = ", response)
    modified_content = response['structured_response'].edited_text
    print(f"modified_content = {modified_content}")

    full_output = leading_context + " " + modified_content + " " + trailing_context

    return full_output

# ===== COMBINED PIPELINE FUNCTION =====

def full_pipeline(input_filepath, query, output_filepath):
    """
    Runs the full document editing pipeline on a specified file using a user query.

    This function extracts the editable section and context from the given file,
    updates the editable section according to the user query, and writes the final
    output to a file named 'output_text.txt'. The complete output is also printed and returned.

    Args:
        input_filepath (str): Path to the input file to be processed.
        query (str): The user's instruction for editing the document.
        output_filepath (str): Path for the output file.

    Returns:
        str: The full updated document content after applying the edit.

    """

    leading_context, editable_section, trailing_context, query = process_editable_section(filename=input_filepath, query=query)

    if leading_context is None:
        raise ValueError("No editable section found in the document. Make sure your document contains <!EDIT_START_CANVAS> and <!EDIT_END_CANVAS> tags.")

    full_output = update_doc(leading_context, editable_section, trailing_context, query)

    print(f"Full output: \n{full_output}")

    with open(output_filepath, "w") as f:
        f.write(full_output)

    return full_output

# ===== API-COMPATIBLE FUNCTION =====

def full_pipeline_api(content: str, query: str) -> str:
    """
    API version of full_pipeline that works with content string instead of file paths.
    
    This is the main function to be used by the FastAPI application.

    Args:
        content (str): The document content as a string
        query (str): The user's instruction for editing the document

    Returns:
        str: The full updated document content after applying the edit

    Raises:
        ValueError: If no editable section is found in the document
    """
    try:
        # Create temporary input file
        temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt', encoding='utf-8')
        temp_file.write(content)
        temp_file.close()
        input_filepath = temp_file.name
        
        # Process the document
        leading_context, editable_section, trailing_context, processed_query = process_editable_section(
            filename=input_filepath, 
            query=query
        )
        
        if leading_context is None:
            raise ValueError("No editable section found in the document. Make sure your document contains <!EDIT_START_CANVAS> and <!EDIT_END_CANVAS> tags.")
        
        # Update the document
        full_output = update_doc(leading_context, editable_section, trailing_context, query)
        
        # Clean up temporary input file
        os.unlink(input_filepath)
        
        return full_output
        
    except Exception as e:
        # Clean up files in case of error
        if 'input_filepath' in locals() and os.path.exists(input_filepath):
            os.unlink(input_filepath)
        raise e

# ===== TEST FUNCTION =====

def test_pipeline():
    """
    Test function to verify the pipeline works correctly
    """
    # Sample content for testing
    sample_content = """# **The Whale and the Gull**  

## **Chapter 1: An Unlikely Rescue**  

### **The Lonely Giant**  
In the vast, sparkling expanse of the Pacific Ocean, a massive blue whale named Kael drifted lazily through the waves.

<!EDIT_START_CANVAS>
Kael's deep voice was warm. *"Friendship doesn't mean staying forever. It means knowing you're never alone."*  

With a final grateful nudge, Pip took flight, calling back, *"I'll find you again!"*  
<!EDIT_END_CANVAS>

**The End.**"""

    query = "Make this ending more emotional and add details about their future meetings"
    
    try:
        result = full_pipeline_api(sample_content, query)
        print("Pipeline test successful!")
        print("Result length:", len(result))
        return result
    except Exception as e:
        print(f"Pipeline test failed: {e}")
        return None

if __name__ == "__main__":
    # Run test when script is executed directly
    test_pipeline()