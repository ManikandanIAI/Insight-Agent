from fastapi import HTTPException
from openai import AsyncOpenAI
import mongodb
import json
import utils
from typing import AsyncGenerator
import json

client = AsyncOpenAI()

async def generate_summary(session_id: str):
    last_message = await mongodb.get_last_msg_in_session(session_id)
    
    if not last_message:
        raise HTTPException(status_code=404, detail="No message found for this session")
    
    text_to_summarize = last_message.response

    async def summarize_text(text: str) -> str:
        response = await client.chat.completions.create(
            model = "gpt-4.1-mini",
            messages = [{
                "role": "user", 
                "content": f'''Below is a response from an AI assistant:

                            {text}

                            Your task:
                            - If the response is too short, vague, or lacks depth, elaborate and enrich the answer to make it more informative and complete.
                            - If the response is too long, verbose, or detailed, summarize it concisely while keeping key information intact.
                            - **Do not mention or refer to any backend systems, agents, APIs, or implementation details used to generate the original response.**
    
                            Output the improved version accordingly.
                            '''
                }]
        )
        return response.choices[0].message.content.strip()

    summary = await summarize_text(text_to_summarize)
    # print(summary)
    return {
        "message_id": last_message.message_id,
        "summary": summary
    }

async def stream_summary(user_id: str, session_id: str,  message_id: str, user_query: str, local_time, is_elaborate: bool = False, give_examples: bool = True) -> AsyncGenerator[str, None]:
    last_message = await mongodb.get_last_msg_in_session(session_id)

    if not last_message:
        yield f"data: {json.dumps({'type': 'error', 'content': 'No message found for this session'})}\n\n"
        return

    text_to_summarize = last_message.response
    text_to_summarize = text_to_summarize["content"]


    operation_title = "Elaborating response" if is_elaborate else "Elaborating response"
    agent_name = "Elaborating Agent" if is_elaborate else "Summarizing Agent"

    base_prompt = f"""Below is a response from an AI assistant:

{text_to_summarize}

Your task:
"""

    if is_elaborate:
        base_prompt += "- The response is short — **elaborate** on it and make it more informative.\n"
    else:
        base_prompt += "- The response is long — condense it into a concise list of 5–10 lines of information.**.\n"

    base_prompt += "- **Do not mention or refer to any backend systems, agents, APIs, or implementation details used to generate the original response.**\n"
    base_prompt += "- Return the final response in **Markdown** format.\n"
    base_prompt += "- Strictly don't return ```markownd ``` content"

    if give_examples:
        base_prompt += (
            "- After the improved response, add a new section titled **Examples**.\n"
            "- Under **Examples**, provide **relevant bullet-point examples** that illustrate key points clearly.\n"
            "- Format both the main content and examples in **Markdown**, but do **not** include triple backticks or code fences.\n"
        )

    try:
        yield f"data: {json.dumps({'type': 'research', 'agent_name': agent_name, 'title': operation_title, 'id': f'summarizerrun--{message_id}', 'created_at': utils.get_date_time().isoformat(), 'message_id': message_id})}\n\n"
        
        stream = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": base_prompt
            }],
            stream=True
        )

        summary_chunks = []
        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    content_piece = delta.content
                    summary_chunks.append(content_piece)
                    yield f"data: {json.dumps({'type': 'response-chunk', 'agent_name': 'Summary Agent', 'message_id': message_id, 'id': f'summarizerrun--{message_id}', 'content': content_piece})}\n\n"

        full_summary = ''.join(summary_chunks)
        # print(full_summary)
        yield f"data: {json.dumps({'type': 'response_time', 'content': '2 sec', 'message_id': message_id})}\n\n"

        yield f"data: {json.dumps({'type': 'complete', 'message_id': message_id, 'notification': True})}\n\n"

        messages_for_db = [
            {
                'user_query': user_query,
                'operation_type': 'elaborate' if is_elaborate else 'summarize',
                'created_at': local_time
            },
            {
                'type': 'research',
                'agent_name': agent_name,
                'title': operation_title,
                'id': f'summarizerrun--{message_id}',
                'created_at': local_time
            },
            {
                'type': 'response',
                'agent_name': agent_name,
                'content': full_summary,
                'id': f'summarizerrun--{message_id}',
                'created_at': local_time
            }
        ]
        local_time = local_time
        
        await mongodb.append_data(
            user_id=user_id,
            session_id=session_id,
            message_id=message_id,
            messages=messages_for_db,
            local_time=local_time,
            time_zone=local_time,
            metadata=None,
            time_taken=2
        )
        await mongodb.update_session_history_in_db(session_id, user_id, message_id, user_query, full_summary, local_time, 'UTC')

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'content': str(e), 'message_id': message_id})}\n\n"
        try:
            error_msg = f"Error in Streaming/Elaborating agent processing: {str(e)}"
            error_messages = [
                {
                    'error': error_msg,
                    'agent_name': agent_name,
                    'message_id': message_id
                }
            ]
            await mongodb.append_data(
                user_id=user_id,
                session_id=session_id,
                message_id=message_id,
                messages=error_messages,
                local_time=utils.get_date_time().isoformat(),
                time_zone='UTC'
            )
            await mongodb.update_session_history_in_db(session_id, user_id, message_id, user_query, error_msg, local_time, 'UTC')
        except Exception as db_error:
            print(f"Failed to save error to database: {db_error}")


# async def stream_summary2(session_id: str) -> AsyncGenerator[str, None]:
#     last_message = await mongodb.get_last_msg_in_session(session_id)

#     if not last_message:
#         yield f"data: {json.dumps({'type': 'error', 'content': 'No message found for this session'})}\n\n"
#         return

#     text_to_summarize = last_message.response
#     try:
#         stream = await client.chat.completions.create(
#             model="gpt-4.1-mini",
#             messages=[{
#                 "role": "user",
#                 "content": f'''Below is a response from an AI assistant:
# {text_to_summarize}
# Your task:
# - If the response is too short, vague, or lacks depth, elaborate and enrich the answer to make it more informative and complete.
# - If the response is too long, verbose, or detailed, summarize it concisely while keeping key information intact.
# - **Do not mention or refer to any backend systems, agents, APIs, or implementation details used to generate the original response.**

# Output the improved version accordingly.
# '''
#             }],
#             stream=True
#         )

#         summary_chunks = []
#         async for chunk in stream:
#             # print("chunk")
#             print(chunk)
#             delta = chunk.choices[0].delta
#             if 'content' in delta:
#                 summary_chunks.append(delta['content'])
#                 print(delta['content'])
#                 yield f"data: {json.dumps({'type': 'summary_chunk', 'content': delta['content'], 'message_id': last_message.message_id})}\n\n"

#         full_summary = ''.join(summary_chunks)
#         yield f"data: {json.dumps({'type': 'complete', 'message_id': last_message.message_id, 'summary': full_summary})}\n\n"

#     except Exception as e:
#         yield f"data: {json.dumps({'type': 'error', 'content': str(e), 'message_id': last_message.message_id})}\n\n"
