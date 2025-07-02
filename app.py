from pydoc import doc
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env", override=True)

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import FastAPI, Request, HTTPException, Query, Depends, Response, status, BackgroundTasks, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse, RedirectResponse, JSONResponse, StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from typing import Optional, Dict, Any, List, Generator, Literal, AsyncGenerator, Annotated
from pydantic import BaseModel, Field, field_validator, model_validator
import asyncio
import json
import os
import uuid
import sys
import traceback
from beanie import PydanticObjectId
from passlib.context import CryptContext
from jose import JWTError
import time
from enum import Enum
from urllib.parse import urlencode
import httpx
import base64
import tempfile
import anyio
from schemas.tool_structured_input import TickerSchema
from tools.finance_data_tools import get_stock_data
import mongodb
from agent_comm import process_agent_input_functional
from deep_research.comm import process_research_query_functional
from agents.fast_agent import process_fast_agent_input
from schemas.app_io import Onboarding, OnboardingRequest, StockPredictionRequest, StockPredictionResponse, APIKeys, UserQuery, StockDataRequest, Registration, ResponseFeedback, Login, ExportResponse, UpdateSessionAccess, EmailVerificationRequest, VerifyOTPRequest, ResetPasswordRequest
from api_utils import create_error_html, create_success_html, generate_otp, build_email_payload, send_email_otp, format_user_principal_name, notify_slack_error, redis_client
from export_utils import markdown_to_pdf, markdown_to_docx, slugify
from contextlib import asynccontextmanager
import utils
from openai import AsyncOpenAI
import filestorage
from stock_prediction import StockAnalysisAgent
from mongodb import CanvasResponseManager,DocumentHistory,DocumentResponse,DocumentListItem,CanvasRequest,VersionInfo,VersionActionRequest, UploadResponse, process_markdown_content, MessageLog
import summarize_me

stock_agent = StockAnalysisAgent()
client = AsyncOpenAI()

@asynccontextmanager
async def on_startup(app: FastAPI):
    await mongodb.init_db()
    yield

app = FastAPI(title="Finance Insight Agent API", lifespan=on_startup)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")
apiSecurity = Annotated[str, Depends(oauth2_scheme)]

os.makedirs("public", exist_ok=True)
os.makedirs("external_data", exist_ok=True)
os.makedirs("graph_logs", exist_ok=True)


@app.get("/", response_class=HTMLResponse)
async def get():
    return FileResponse(path="out/index.html")

    
@app.get("/get_user_info")
async def user_by_id(user_id: str):
    user = await mongodb.get_user_details(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found or inactive")
    return user


@app.patch("/user/{user_id}")
async def update_user(user_id: str, request: mongodb.UpdateUserRequest):
    user = await mongodb.update_user_profile(
        user_id=user_id,
        full_name=request.full_name,
        email=request.email,
        profile_picture=request.profile_picture
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/personalization_info/{user_id}", response_model=Optional[mongodb.Personalization])
async def get_user_personalization(user_id: str):
    personalization = await mongodb.get_personalization(user_id)
    if not personalization:
        raise HTTPException(status_code=404, detail="Personalization not found")
    return personalization

@app.post("/personalization/{user_id}", response_model=mongodb.Personalization)
async def update_user_personalization(user_id: str, request: mongodb.PersonalizationRequest):
    updated = await mongodb.create_or_update_personalization(user_id, request.dict(exclude_unset=True))
    return updated



@app.post("/set_api_keys")
async def set_api_keys(token: apiSecurity, request: Request):
    keys = await request.json()
    if keys.get('gemini_api_key'):
        os.environ["GEMINI_API_KEY"] = keys.get('gemini_api_key')
    if keys.get('groq_api_key'):
        os.environ["GROQ_API_KEY"] = keys.get('groq_api_key')
    
    return {"message": "API keys updated successfully."}


@app.get("/sessions/{user_id}")
async def list_sessions(token: apiSecurity, user_id: str):
    """
    Fetch all sessions of a user, ordered by timestamp.
    """
    sessions = await mongodb.get_sessions_by_user(user_id)
    if not sessions:
        raise HTTPException(status_code=404, detail="No sessions found for this user.")
    return sessions

@app.get("/filter-with-title/{user_id}/search")
async def search_sessions_by_title(
    user_id: str,
    keyword: str = Query(..., min_length=1, description="Keyword to search for")
) -> List[Dict]:
    """
    Return sessions whose title contains the keyword (case-insensitive), grouped by timeline.
    """
    print('1')
    result = await mongodb.get_sessions_by_user_and_keyword(user_id, keyword)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"No sessions found with title containing “{keyword}”."
        )
    return result

# @app.get("/filter-with-keyword/{user_id}/search")
# async def search_sessions_by_keyword(
#     user_id: str,
#     keyword: str = Query(..., min_length=1, description="Keyword to search for")
# ) -> List[Dict]:
#     """
#     Return sessions whose title contains the keyword (case-insensitive), grouped by timeline.
#     """
#     print('1')
#     result = await mongodb.get_sessions_by_user_and_keyword2(user_id, keyword)
#     if not result:
#         raise HTTPException(
#             status_code=404,
#             detail=f"No sessions found with title containing “{keyword}”."
#         )
#     return result


@app.get("/messages")
async def list_messages(token: apiSecurity, session_id: str = Query(..., alias="sessionId"), user_id: str = Query(..., alias="user_id")):
    """
    Fetch all message logs for a session, ordered by timestamp.
    """
    try:
        session_log = await mongodb.get_session_log_by_user_and_session_id(user_id, session_id)

        if not session_log:
            raise HTTPException(status_code=404, detail="Session not found or access denied.")

        messages = await mongodb.get_messages_by_session(session_id)

        if not messages:
            raise HTTPException(status_code=404, detail="No messages found for this session.")

        return messages

    except HTTPException as http_exc:
        raise http_exc

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encountered error in loading session messages: {str(e)}")


# @app.delete("/delete/{session_id}")
# async def delete_session(token: apiSecurity, session_id: str):
#     # add logic to delete session
#     return {"status": "success"}

@app.delete("/delete/{session_id}")
async def delete_session(token: apiSecurity, session_id: str):
    result = await mongodb.delete_session(session_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID '{session_id}' not found"
        )

    return {"status": "success", "message": f"Session '{session_id}' deleted"}

# @app.post("/upload_files")
# async def upload_files(
#     token: apiSecurity, 
#     user_id: str = Form(...), 
#     files: UploadFile = File(...)
# ):
#     return await filestorage.upload_files(user_id, files)

@app.post("/upload-files")
async def upload_files(
    user_id: str,
    file: UploadFile = File(...)
):
    try:
        file_id = await filestorage.upload_files(user_id, file)
        await file.seek(0)
        result = await mongodb.upload_to_azure_blob(file_id, file)
        return JSONResponse(status_code=200, content={
            "message": "File uploaded successfully",
            **result
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")
    

@app.get("/get_upload_url/{file_id}") 
async def get_upload_url(file_id: str):
    doc = await UploadResponse.find_one({"file_id": file_id})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
        
    return {"url": doc.blob}

@app.get("/preview_file/{file_id}")
async def preview_file(file_id: str):
    try:
        filename, stream = await mongodb.download_blob_stream(file_id)
        
        # Get file extension to determine media type
        file_extension = filename.split('.')[-1].lower() if '.' in filename else ''
        
        # Map common file types to proper media types
        media_type_map = {
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'txt': 'text/plain',
            'html': 'text/html',
            'csv': 'text/csv',
            'json': 'application/json',
            'xml': 'application/xml',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        }
        
        media_type = media_type_map.get(file_extension, 'application/octet-stream')
        
        return StreamingResponse(
            stream,
            media_type=media_type,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',  # Changed to 'inline'
                "Cache-Control": "no-cache"
            }
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error previewing file: {str(e)}")
    

@app.get("/download_file/{file_id}")
async def download_file(file_id: str):
    try:
        filename, stream = await mongodb.download_blob_stream(file_id)
        return StreamingResponse(
            stream,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")


class QueryRequestModel(BaseModel):
    user_id :str
    user_query : str
    session_id : str
    realtime_info : bool = True
    search_mode : Literal['fast', 'agentic-planner', 'agentic-reasoning', 'summarizer'] = 'fast' 
    retry_response : bool = False
    message_id : str
    prev_message_id : str
    deep_research : bool = False
    timezone : str = "UTC"
    doc_ids : list = []
    is_elaborate: bool = False
    is_example: bool = False

    @field_validator('message_id')
    @classmethod
    def validate_message_id(cls, v):
        if not v or v == "":
            return str(uuid.uuid4())
        return v

@app.post("/query-stream")
async def query_and_stream(query: QueryRequestModel, request: Request, bgt: BackgroundTasks):

    user_id = query.user_id
    user_query = query.user_query
    session_id = query.session_id
    realtime_info = query.realtime_info
    search_mode = query.search_mode
    retry_response = query.retry_response
    message_id = query.message_id
    prev_message_id = query.prev_message_id
    deep_research = query.deep_research
    timezone = query.timezone
    doc_ids = query.doc_ids
    ip_address = request.client.host
    website = str(request.base_url)
    is_elaborate = query.is_elaborate
    is_example = query.is_example

    user_tz = ZoneInfo(timezone)
    local_time = datetime.now(user_tz)

    if (not user_id or not user_query):
        async def error_gen_missing_field():
            error_event = {"type": "error", "content": "user_id and user_query are required."}
            yield f"event: error\ndata: {json.dumps(error_event)}\n\n"
        
        return StreamingResponse(error_gen_missing_field(), media_type="text/event-stream", status_code=422)
    
    if deep_research and (not message_id.startswith('deep')):
        message_id = 'deep-' + message_id
    
    if not session_id:
        session_id = str(uuid.uuid4())
    # bgt.add_task(mongodb.store_user_query,user_id, session_id, message_id, user_query, timezone)
    async def event_generator() -> AsyncGenerator[str, None]:
        nonlocal session_id, message_id

        session_info_event_data = {
            "session_id": session_id,
            "message_id": message_id,
            "status": "starting deep research query processing" if deep_research else "starting query processing"
        }
        yield f"event: session_info\ndata: {json.dumps(session_info_event_data)}\n\n"

        token_buffer = []
        stock_graph = set()
        user_data = await mongodb.fetch_user_by_id(user_id)
        user_name = user_data.get('full_name', user_id)
        error_flag = False

        processor_iterator = None
        try:
            if deep_research:
                processor_iterator = process_research_query_functional(
                    user_id=user_id,
                    session_id=session_id,
                    user_query=user_query,
                    message_id=message_id,
                    prev_message_id=prev_message_id,
                    timezone = timezone
                )
                
            else:
                if search_mode == 'fast':
                    processor_iterator = process_fast_agent_input(
                        user_id=user_id,
                        session_id=session_id,
                        user_query=user_query,
                        message_id=message_id,
                        prev_message_id=prev_message_id,
                        timezone = timezone,
                        ip_address = ip_address,
                        doc_ids = doc_ids
                    )
                elif search_mode == 'summarizer':
                    async for event in summarize_me.stream_summary(user_id, session_id, message_id, user_query, local_time, is_elaborate, is_example):
                        yield event.encode('utf-8')
                    return
                else:
                    pro_reasoning = (search_mode == 'agentic-reasoning')

                    processor_iterator = process_agent_input_functional(
                        user_id=user_id,
                        session_id=session_id,
                        user_query=user_query,
                        message_id=message_id,
                        prev_message_id=prev_message_id,
                        realtime_info=realtime_info,
                        pro_reasoning=pro_reasoning,
                        retry_response=retry_response,
                        timezone = timezone,
                        ip_address = ip_address,
                        doc_ids = doc_ids,
                    )

            TIMEOUT_PERIOD = 300
            time_taken = 0
            while True:
                try:
                    data_from_processor = await asyncio.wait_for(anext(processor_iterator), timeout=TIMEOUT_PERIOD)
                except asyncio.TimeoutError:
                    raise RuntimeError(f"No update from processor for {TIMEOUT_PERIOD} seconds. Stream aborted.")
                except Exception as e:
                    raise RuntimeError(f"Error in waiting for data: {str(e)}")

                data_to_send = data_from_processor.copy()

                if 'start_stream' in data_to_send:
                    payload = {"type": "connected", "message_id": message_id}
                    yield f"data: {json.dumps(payload)}\n\n".encode('utf-8')

                elif 'type' in data_to_send and data_to_send['type'].endswith('chunk'):
                    # agent_changed = (token_buffer and (data_to_send.get('agent_name', '') != token_buffer[0].get('agent_name', '') or data_to_send.get('id', '') != token_buffer[0].get('id', '')))

                    if token_buffer and (len(token_buffer) >= 5 or data_to_send.get('agent_name') != token_buffer[0].get('agent_name')):
                        batched_event_type = token_buffer[0].get('type', 'unknown_chunk_type')
                        
                        batched_event = {
                            "type": batched_event_type, 
                            "agent_name": token_buffer[0].get('agent_name', ''), 
                            "message_id": message_id, 
                            "id": token_buffer[0].get('id','')
                        }

                        if any('content' in t for t in token_buffer):
                            batched_event["content"] = "".join([t.get('content','') for t in token_buffer if 'content' in t])

                        if any('title' in t for t in token_buffer):
                            batched_event["title"] = "".join([t.get('title','') for t in token_buffer if 'title' in t])

                        yield f"data: {json.dumps(batched_event)}\n\n".encode('utf-8')
                        token_buffer = []

                    token_buffer.append(data_to_send)

                else:
                    if token_buffer:
                        batched_event_type = token_buffer[0].get('type', 'unknown_chunk_type')
                        
                        batched_event = {
                            "type": batched_event_type, 
                            "agent_name": token_buffer[0].get('agent_name', ''), 
                            "message_id": message_id, 
                            "id": token_buffer[0].get('id','')
                        }

                        if any('content' in t for t in token_buffer):
                            batched_event["content"] = "".join([t.get('content','') for t in token_buffer if 'content' in t])

                        if any('title' in t for t in token_buffer):
                            batched_event["title"] = "".join([t.get('title','') for t in token_buffer if 'title' in t])

                        yield f"data: {json.dumps(batched_event)}\n\n".encode('utf-8')
                        token_buffer = []

                    if 'type' in data_to_send:
                        if data_to_send['type'] == 'stock_data':
                            symbol = data_to_send['data']['realtime']['symbol']
                            if symbol not in stock_graph:
                                stock_graph.add(symbol)
                                stock_payload = {"stock_data": data_to_send.get('data'), "message_id": message_id, "id": data_to_send.get('id', '')}
                                yield f"event: stock_chart\ndata: {json.dumps(stock_payload)}\n\n".encode('utf-8')

                        elif data_to_send['type'] == 'map_layers':
                            data_to_send['message_id'] = message_id
                            yield f"event: map_data\ndata: {json.dumps(data_to_send)}\n\n".encode('utf-8')
                        
                        else:
                            data_to_send['message_id'] = message_id
                            yield f"data: {json.dumps(data_to_send)}\n\n".encode('utf-8')

                    elif 'time' in data_to_send:
                        time_taken = data_to_send.get('in_seconds', 0)
                        time_payload = {
                            "type": "response_time", 
                            "content": data_to_send['time'],
                            "message_id": message_id
                        }
                        yield f"data: {json.dumps(time_payload)}\n\n".encode('utf-8')
                    
                    elif 'state' in data_to_send:
                        if 'sources' in data_to_send and data_to_send.get('sources'):
                            sources_payload = {"type": "sources", "content": data_to_send['sources'], "message_id": message_id}
                            yield f"data: {json.dumps(sources_payload)}\n\n".encode('utf-8')

                        if 'related_queries' in data_to_send and data_to_send.get('related_queries'):
                            related_payload = {"type": "related_queries", "content": data_to_send['related_queries'], "message_id": message_id}
                            yield f"data: {json.dumps(related_payload)}\n\n".encode('utf-8')

                    elif 'error' in data_to_send:
                        error_flag = True
                        error_payload = {"type": "error", "content": data_to_send['error'], "message_id": message_id}

                        if not ("localhost" in website or "127.0.0.1" in website):
                            await notify_slack_error(user_name or user_id, str(error_payload))

                        yield f"data: {json.dumps(error_payload)}\n\n".encode('utf-8')
                    
                    elif 'store_data' in data_to_send:
                        store_data = data_to_send['store_data']
                        bgt.add_task(mongodb.append_data, user_id, session_id, message_id, store_data['messages'], local_time, timezone, store_data.get('metadata', None), time_taken)
                        # if store_data.get("metadata") == None:
                        #     print("metadata null")
                        #     print(store_data)
                        yield f"data: {json.dumps({'type': 'metadata', 'data': store_data.get('metadata',None)})}\n\n".encode('utf-8')

                        if not error_flag:
                            yield f"data: {json.dumps({'type': 'complete', 'message_id': message_id, 'notification': True})}\n\n".encode('utf-8')
                        
                        if store_data['logs']:
                            bgt.add_task(mongodb.append_graph_log_to_mongo, session_id, message_id, store_data['logs'])

                        break

                    elif 'logs' in data_to_send:
                        if 'metadata' in data_to_send:
                            yield f"data: {json.dumps({'type': 'metadata', 'data': data_to_send.get('metadata',None)})}\n\n".encode('utf-8')

                        if not error_flag:
                            yield f"data: {json.dumps({'type': 'complete', 'message_id': message_id, 'notification': False})}\n\n".encode('utf-8')

                        bgt.add_task(mongodb.append_graph_log_to_mongo, session_id, message_id, data_to_send['logs'])
                        break

        except Exception as e:
            traceback.print_exc()
            error_payload = {"type": "error", "content": f"Critical stream processing error: {str(e)}", "message_id": message_id}

            if not ("localhost" in website or "127.0.0.1" in website):
                await notify_slack_error(user_name or user_id, str(error_payload))

            yield f"data: {json.dumps(error_payload)}\n\n".encode('utf-8')

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )

@app.post("/stop-generation")
async def stop_response_generation(token: apiSecurity, session_id: str = Query(..., alias="session_id"), message_id: str = Query(..., alias="message_id")):
    key = f"stop:{session_id}"
    await redis_client.set(key, message_id, 3)


@app.post("/login")
async def login_user_endpoint(login: Annotated[OAuth2PasswordRequestForm, Depends()], response: Response):
    user = await mongodb.get_user(login.username)
    if user and user.auth_provider != 'local':
        raise HTTPException(
            status_code=400, detail="Please login using your Google or Microsoft account.")
    if not user or not pwd_context.verify(login.password.encode('utf-8'), user.password):
        raise HTTPException(
            status_code=400, detail="Invalid email or password or account does not exists.")

    access_token = mongodb.jwt_handler.create_access_token(
        {"user_id": str(user.id), "email": user.email}
    )
    response.set_cookie(
        key="access_token", value=access_token, httponly=False, max_age=60 * 60 * 24 * 30
    )

    return {"access_token": access_token, "token_type": "bearer", "user_id": str(user.id)}


# @app.post("/registration")
# async def register_user_endpoint(registration: Registration, response: Response):
#     hashed_password = pwd_context.hash(registration.password)
#     user_data = registration.model_dump()
#     user_data.update({"password": hashed_password, "auth_provider": "local"})

#     existing_user = await mongodb.get_user(registration.email)
#     if existing_user:
#         raise HTTPException(
#             status_code=400, detail="Email already exists. Please log in.")

#     new_user = await mongodb.create_user(user_data)
#     access_token = mongodb.jwt_handler.create_access_token(
#         {"user_id": str(new_user.id), "email": new_user.email}
#     )
#     response.set_cookie(
#         key="access_token", value=access_token, httponly=False, max_age=60 * 60 * 24 * 30
#     )

#     return {"access_token": access_token, "token_type": "bearer", "user_id": str(new_user.id)}

@app.delete("/user/{user_id}")
async def deactivate_user(user_id: str):
    message = await mongodb.deactivate_user_service(user_id)
    return {"detail": message}


@app.get("/get-token", include_in_schema=True)
async def get_current_user_endpoint(token: apiSecurity):
    user = await mongodb.get_user_by_id(token)
    return user


@app.get("/google-auth")
async def google_auth_endpoint(request: Request):
    """
    Redirects the user to Google's OAuth 2.0 server for authentication.
    """
    base_url=str(request.base_url)

    if base_url.startswith("http:"):
        base_url = base_url.replace("http:", "https:")

    if "localhost" in base_url or "127.0.0.1" in base_url:
        base_url = "http://localhost:8000/"
    
    params = {
        "client_id": os.getenv('GOOGLE_CLIENT_ID'),
        "redirect_uri": base_url+"google-auth/callback",
        "response_type": "code",
        "scope": os.getenv('GOOGLE_SCOPES'),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state":base_url
    }
    google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    print(google_auth_url)
    return RedirectResponse(url=google_auth_url)


@app.get("/google-auth/callback", tags=["Authentication"])
async def auth_google_callback(request: Request, response: Response):
    received_code = request.query_params.get("code")
    base_url = request.query_params.get("state")

    # --- State Verification (CSRF Protection) ---
    # Retrieve the original state (retrieve from where you stored it - session, cache, db)
    # original_state = temp_state_storage.pop('latest_state', None) # Simplistic retrieval

    # if not received_state or received_state != original_state:
    #     return HTMLResponse(content=create_error_html("Invalid state parameter. CSRF attack suspected."))

    if not received_code:
        error = request.query_params.get("error", "Unknown error")
        error_description = request.query_params.get("error_description", "No description provided.")
        return HTMLResponse(content=create_error_html(f"Google Auth Error: {error} - {error_description}",base_url))
    
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": received_code,
        "client_id": os.getenv('GOOGLE_CLIENT_ID'),
        "client_secret": os.getenv('GOOGLE_CLIENT_SECRET'),
        "redirect_uri": base_url+"google-auth/callback",
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(token_url, data=token_data)
            token_response.raise_for_status()
            token_json = token_response.json()

        except httpx.HTTPStatusError as e:
            print(f"Error exchanging code for token: {e.response.text}")
            return HTMLResponse(content=create_error_html(f"Failed to exchange authorization code with Google: {e.response.text}",base_url))
        except Exception as e:
            print(f"Network or other error during token exchange: {e}")
            return HTMLResponse(content=create_error_html("Error communicating with Google for token exchange.",base_url))

    google_access_token = token_json.get("access_token")

    if not google_access_token:
        return HTMLResponse(content=create_error_html("Could not retrieve access token from Google.",base_url))

    user_info_url = "https://www.googleapis.com/oauth2/v3/userinfo"
    headers = {"Authorization": f"Bearer {google_access_token}"}

    async with httpx.AsyncClient() as client:
        try:
            user_info_response = await client.get(user_info_url, headers=headers)
            user_info_response.raise_for_status()
            user_info = user_info_response.json()

        except httpx.HTTPStatusError as e:
            print(f"Error fetching user info from UserInfo endpoint: {e.response.text}")
            return HTMLResponse(content=create_error_html(f"Failed to fetch user info from Google: {e.response.text}",base_url))
        except Exception as e:
            print(f"Network or other error during user info fetch: {e}")
            return HTMLResponse(content=create_error_html("Error communicating with Google for user info.",base_url))

    email = user_info.get("email")
    full_name = user_info.get("name", "NA")
    picture = user_info.get("picture")

    if not email:
        return HTMLResponse(content=create_error_html("Could not retrieve primary email from Google.",base_url))

    user = await mongodb.get_user(email)

    if user:
        if user.auth_provider != "google":
            print(f"Warning: User {email} exists with provider {user.auth_provider}. Logging in via Google.")
            return HTMLResponse(content=create_error_html(f"Account already exists with {user.auth_provider} authentication. Please login using your {user.auth_provider} credentials.",base_url))
        user_id = str(user.id)
    else:
        print(f"Creating new user for {email} via Google.")
        user_data = {
            "email": email,
            "full_name": full_name,
            "auth_provider": "google",
            "profile_picture": picture,
        }

        try:
            new_user = await mongodb.create_user(user_data)
            user_id = str(new_user.id)
        except Exception as e:
            print(f"Database error creating user {email}: {e}")
            return HTMLResponse(content=create_error_html(f"Failed to create user profile in database.",base_url))

    access_token = mongodb.jwt_handler.create_access_token({"user_id": user_id, "email": email})
    
    return HTMLResponse(content=create_success_html(access_token,base_url))


@app.get("/microsoft-auth")
async def microsoft_auth_endpoint(request: Request):
    base_url=str(request.base_url)

    if base_url.startswith("http:"):
        base_url = base_url.replace("http:", "https:")

    if "localhost" in base_url or "127.0.0.1" in base_url:
        base_url = "http://localhost:8000/"
    
    params = {
        "client_id": os.getenv('MICROSOFT_CLIENT_ID'),
        "response_type": "code",
        "redirect_uri": base_url+"microsoft-auth/callback",
        "response_mode": "query",
        "scope": os.getenv('MICROSOFT_SCOPES'),
        "prompt": "select_account",
        "state": base_url,
    }
    microsoft_auth_url = f"https://login.microsoftonline.com/{os.getenv('MICROSOFT_TENANT_ID')}/oauth2/v2.0/authorize?{urlencode(params)}"
    print(microsoft_auth_url)
    return RedirectResponse(url=microsoft_auth_url)


@app.get("/microsoft-auth/callback")
async def auth_microsoft_callback(request: Request, response: Response):
    received_code = request.query_params.get("code")
    base_url = request.query_params.get("state")

    # # --- State Verification (CSRF Protection) ---
    # original_state = temp_state_storage.pop('ms_auth_state', None) # Retrieve stored state

    # if not received_state or received_state != original_state:
    #     return HTMLResponse(content=create_error_html("Invalid state parameter. Possible CSRF attack.",base_url))

    if not received_code:
        error = request.query_params.get("error", "Unknown error")
        error_description = request.query_params.get("error_description", "No description provided.")
        if error == 'access_denied':
            return HTMLResponse(content=create_error_html(f"Microsoft Auth Error: Access Denied by user. {error_description}",base_url))
        return HTMLResponse(content=create_error_html(f"Microsoft Auth Error: {error} - {error_description}",base_url))

    token_data = {
        "client_id": os.getenv('MICROSOFT_CLIENT_ID'),
        "scope": os.getenv('MICROSOFT_SCOPES'), # Required again for token endpoint
        "code": received_code,
        "redirect_uri": base_url+"microsoft-auth/callback",
        "grant_type": "authorization_code",
        "client_secret": os.getenv('MICROSOFT_CLIENT_SECRET'),
    }

    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(f"https://login.microsoftonline.com/{os.getenv('MICROSOFT_TENANT_ID')}/oauth2/v2.0/token", data=token_data)
            token_response.raise_for_status()
            token_json = token_response.json()
            print(token_json)
        except httpx.HTTPStatusError as e:
            print(f"Error exchanging code for token (Microsoft): {e.response.text}")
            return HTMLResponse(content=create_error_html(f"Failed to exchange authorization code with Microsoft: {e.response.text}",base_url))
        except Exception as e:
            print(f"Network or other error during token exchange (Microsoft): {e}")
            return HTMLResponse(content=create_error_html("Error communicating with Microsoft for token exchange.",base_url))

    microsoft_access_token = token_json.get("access_token")

    if not microsoft_access_token:
        return HTMLResponse(content=create_error_html("Could not retrieve access token from Microsoft.",base_url))

    headers = {"Authorization": f"Bearer {microsoft_access_token}"}
    # Select specific fields needed to minimize data transfer
    select_fields = "displayName,mail,userPrincipalName"

    async with httpx.AsyncClient() as client:
        try:
            user_info_response = await client.get(f"https://graph.microsoft.com/v1.0/me?$select={select_fields}", headers=headers)
            user_info_response.raise_for_status()
            user_info = user_info_response.json()
        
        except httpx.HTTPStatusError as e:
            print(f"Error fetching user info from Microsoft Graph: {e.response.text}")
            return HTMLResponse(content=create_error_html(f"Failed to fetch user info from Microsoft Graph: {e.response.text}",base_url))
        except Exception as e:
            print(f"Network or other error during user info fetch (Microsoft): {e}")
            return HTMLResponse(content=create_error_html("Error communicating with Microsoft Graph for user info.",base_url))
        
        # try:
        #     photo_resp = await client.get("https://graph.microsoft.com/v1.0/me/photo/$value", headers=headers)
        #     if photo_resp.status_code == 200:
        #         profile_picture_base64 = base64.b64encode(photo_resp.content).decode("utf-8")
        #     else:
        #         profile_picture_base64 = None
        # except Exception:
        #     profile_picture_base64 = None
    
    email = user_info.get("mail") or user_info.get("userPrincipalName")
    full_name = user_info.get("displayName", "NA") # Use displayName

    if not email:
        return HTMLResponse(content=create_error_html("Could not retrieve user email (mail or userPrincipalName) from Microsoft Graph.",base_url))

    user = await mongodb.get_user(format_user_principal_name(email))

    if user:
        if user.auth_provider != "outlook":
            print(f"Warning: User {format_user_principal_name(email)} exists with provider {user.auth_provider}. Attempted login via Microsoft.")
            return HTMLResponse(content=create_error_html(f"Account already exists with {user.auth_provider} authentication. Please login using your {user.auth_provider} credentials.",base_url))
        
        user_id = str(user.id)
    else:
        print(f"Creating new user for {email} via Microsoft.")
        user_data = {
            "email": format_user_principal_name(email),
            "full_name": full_name,
            "auth_provider": "outlook",
            #"profile_picture": profile_picture_base64,
        }

        try:
            new_user = await mongodb.create_user(user_data)
            user_id = str(new_user.id)
        except Exception as e:
            print(f"Database error creating Microsoft user {email}: {e}")
            return HTMLResponse(content=create_error_html(f"Failed to create user profile in database.",base_url))

    access_token = mongodb.jwt_handler.create_access_token({"user_id": user_id, "email": email})

    return HTMLResponse(content=create_success_html(access_token,base_url))


@app.post("/stock_data")
async def stock_data_endpoint(token: apiSecurity, request: Request):
    """
    Get real-time stock quote data and historical stock prices based on the period.
    Allowed periods: '1mo', '3mo', '6mo', 'ytd', '1y', '5y', 'max'.
    """
    try:
        request = await request.json()
        request = StockDataRequest(**request)
        period = request.period.lower()
        if period.endswith('m'):
            period = period+"o"

        ticker_data = TickerSchema(ticker=request.ticker, exchange_symbol=request.exchange_symbol)
        result_json = await asyncio.to_thread(
            get_stock_data._run,
            ticker_data=[ticker_data],
            period=period
        )
        
        response_data = result_json[0]
        
        if 'error' in response_data['realtime'] or 'error' in response_data['historical']:
            print(response_data['realtime'].get('error', "NA"), response_data['historical'].get('error', "NA"))
            raise HTTPException(status_code=500, detail=f"Encountered error in fetching stock data.")
        
        return {"stock_data": response_data, "message_id": request.message_id, 'id': request.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stock data: {str(e)}")


@app.put("/response-feedback")
async def response_feedback(token: apiSecurity, request: Request):
    try:
        request = await request.json()
        rf = ResponseFeedback(**request)
        result = await mongodb.add_response_feedback(message_id=rf.message_id, response_id=rf.response_id, liked=rf.liked, feedback_tag=rf.feedback_tag, human_feedback=rf.human_feedback)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error in storing response feedback: {str(e)}")


@app.post("/export-response")
async def export_response_endpoint(token: apiSecurity, request: Request):
    # Parse request body
    request = await request.json()
    request = ExportResponse(**request)
    
    # Fetch the chat log by message ID
    data = await mongodb.get_response_by_message_id(request.message_id)
    if not data or 'error' in data:
        raise HTTPException(status_code=404, detail="Response not found.")

    query_text = data['query']
    markdown_content = f"# {query_text}\n\n{data['response']}"

    file_content_64 = ""
    filename = ""

    if request.format == 'md':
        file_content_64 = base64.b64encode(markdown_content.encode('utf-8')).decode('utf-8')
        filename = f"{slugify(query_text)}.md"

    elif request.format == 'pdf':
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            pdf_path = tmp.name
        try:
            await markdown_to_pdf(markdown_content, pdf_path)
            with open(pdf_path, "rb") as f:
                file_content_64 = base64.b64encode(f.read()).decode('utf-8')
        finally:
            os.remove(pdf_path)
        filename = f"{slugify(query_text)}.pdf"

    elif request.format == 'docx':
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
            docx_path = tmp.name
        try:
            await markdown_to_docx(markdown_content, docx_path)
            with open(docx_path, "rb") as f:
                file_content_64 = base64.b64encode(f.read()).decode('utf-8')
        finally:
            os.remove(docx_path)
        filename = f"{slugify(query_text)}.docx"

    else:
        raise HTTPException(status_code=400, detail="Unsupported format.")

    # Validate export result
    if not file_content_64:
        raise HTTPException(status_code=500, detail="File export failed. Empty file content.")

    return {
        "file_content_64": file_content_64,
        "filename": filename
    }


@app.put("/update-session-access")
async def update_session_access_endpoint(request: Request):
    try:
        request = await request.json()
        data = UpdateSessionAccess(**request)
        result = await mongodb.change_session_access_level(data.session_id, data.user_id, data.access_level)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating session access: {str(e)}")


@app.get("/public/{session_id}")
async def list_messages(session_id: str):
    try:
        is_public = await mongodb.check_public_session(session_id)

        if is_public:
            messages = await mongodb.get_messages_by_session(session_id)

            if not messages:
                raise HTTPException(status_code=404, detail="No messages found.")

            return messages

        else:
            raise HTTPException(status_code=404, detail="Session not found.")

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching public session messages: {str(e)}")


@app.get("/map-data/{message_id}")
async def get_map_data(token: apiSecurity, message_id: str):
    """
    Fetch Map Agent Data from MongoDB
    """
    try:
        result = await mongodb.fetch_map_data(message_id=message_id)

        if not result:
            raise HTTPException(status_code=404, detail="Map data not found")
        
        return result
    
    except HTTPException as he:
        raise he
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching public session messages: {str(e)}")


@app.post("/send-verification-otp")
async def send_verification_otp(data: EmailVerificationRequest):
    # For registration: Check if user already exists
    if data.purpose == "registration":
        existing_user = await mongodb.get_user(data.email)
        if existing_user:
            raise HTTPException(
                status_code=400, detail="Email already exists. Please log in.")
    
    # For password reset: Check if user exists
    elif data.purpose == "password_reset":
        user = await mongodb.get_user(data.email)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User email doesn't exist"
            )
        elif user.auth_provider != "local":
            raise HTTPException(
                status_code=400,
                detail="Password reset is only available for email registered accounts. Please use your Google or Microsoft account to log in."
            )
        # Use the actual user name from DB
        data.name = user.full_name

    # Generate and store OTP with expiration time (15 minutes)
    otp = generate_otp()
    expiry_time = datetime.utcnow() + timedelta(minutes=15)

    token_data = {
        "otp": otp,
        "expiry": expiry_time.isoformat(),
        "purpose": data.purpose,
        "verified": False
    }

    # Save to Redis with 15-minute expiry
    key = f"otp:{data.email}"
    await redis_client.set(key, json.dumps(token_data), ex=900)
    
    print(f"[OTP] {data.purpose} verification for {data.email} -> {otp}, expires at {expiry_time}")

    # Build payload for email
    json_payload = build_email_payload(data.email, data.name, otp, data.purpose)

    # Send email in a worker thread
    status_code, body_text = await anyio.to_thread.run_sync(send_email_otp, json_payload)

    print(f"[MSG91] {status_code} • {body_text}")

    if status_code != 200:
        raise HTTPException(
            status_code=500,
            detail=f"Email service error ({status_code}): {body_text}"
        )

    return {"message": "Verification code sent to your email", "success": True}


@app.post("/verify-otp")
async def verify_otp(data: VerifyOTPRequest, response: Response):
    key = f"otp:{data.email}"
    stored = await redis_client.get(key)

    if not stored:
        raise HTTPException(400, "Invalid or expired request")
    
    token = json.loads(stored)

    if datetime.utcnow() > datetime.fromisoformat(token["expiry"]):
        await redis_client.delete(key)
        raise HTTPException(400, "OTP has expired")

    if data.otp != token["otp"]:
        raise HTTPException(400, "Invalid OTP")

    token["verified"] = True
    await redis_client.set(key, json.dumps(token), ex=300)

    # ────────── case A: registration ──────────
    if token["purpose"] == "registration":
        regdata = token["registration_data"]

        # double-check user still absent
        if await mongodb.get_user(regdata["email"]):
            await redis_client.delete(key)
            raise HTTPException(400, "Email already exists. Please log in.")

        # create user
        new_user = await mongodb.create_user(regdata)
        access   = mongodb.jwt_handler.create_access_token(
                      {"user_id": str(new_user.id), "email": new_user.email})

        #  set auth cookie               (optional—comment out if using JWT header only)
        response.set_cookie("access_token", access, httponly=False,
                            max_age=60 * 60 * 24 * 30)

        # cleanup
        await redis_client.delete(key)

        return {
            "message": "OTP verified & account created",
            "success": True,
            "access_token": access,
            "token_type": "bearer",
            "user_id": str(new_user.id)
        }

    # ────────── case B: password reset ──────────
    # simply acknowledge; actual reset happens in /forgot-password/reset
    return {
        "message": "OTP verified successfully",
        "success": True,
        "purpose": "password_reset"
    }


@app.post("/registration")
async def register_user_endpoint(reg: Registration):
    # 0. Email exists?
    if await mongodb.get_user(reg.email):
        raise HTTPException(400, "Email already exists. Please log in.")

    key = f"otp:{reg.email}"
    existing = await redis_client.get(key)
    if existing:
        await redis_client.delete(key)
        existing = await redis_client.get(key)
    # 1. No token yet  → create OTP & stash hashed pwd
    if not existing:
        otp     = generate_otp()
        expiry  = datetime.utcnow() + timedelta(minutes=5)
        regdata = {
            "email": reg.email,
            "password": pwd_context.hash(reg.password.encode('utf-8')),
            "full_name": reg.full_name,
            "auth_provider": "local",
        }

        value = {
            "otp": otp,
            "expiry": expiry.isoformat(),
            "purpose": "registration",
            "verified": False,
            "registration_data": regdata
        }

        await redis_client.set(key, json.dumps(value), ex=300)  # 5 minutes

        # send the email
        payload = build_email_payload(reg.email, reg.full_name, otp, "registration")
        status, body = await anyio.to_thread.run_sync(send_email_otp, payload)

        if status != 200:
            raise HTTPException(500, f"Failed to send OTP: {body}")

        return {"otp_sent": True, "message": "Verification OTP sent. Please verify to complete registration."}

    # 2. Token exists but not verified → tell user to verify
    existing_data = json.loads(existing)
    if not existing_data.get("verified", False):
        raise HTTPException(400, "Please verify the OTP sent to your email.")

    # 3. Should never reach here now – account was auto-created in /verify-otp
    raise HTTPException(400, "Registration already completed, please log in.")


@app.post("/forgot-password/reset")
async def reset_password(data: ResetPasswordRequest):
    key = f"otp:{data.email}"
    token_raw = await redis_client.get(key)
    
    # Verify token exists and is verified
    if not token_raw:
        raise HTTPException(status_code=400, detail="Please verify OTP first")
    
    token_data = json.loads(token_raw)

    if not token_data.get("verified", False):
        raise HTTPException(status_code=400, detail="Please verify OTP first")
    
    # Verify this was for password reset
    if token_data["purpose"] != "password_reset":
        raise HTTPException(
            status_code=400, 
            detail="Email verification was not done for password reset"
        )
    
    if datetime.utcnow() > datetime.fromisoformat(token_data["expiry"]):
        await redis_client.delete(key)
        raise HTTPException(status_code=400, detail="Reset session has expired")
    
    # Get user from database
    user = await mongodb.get_user(data.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Hash new password
    hashed_password = pwd_context.hash(data.new_password.encode('utf-8'))
    
    # Update password in database
    success = await mongodb.update_user_password(data.email, hashed_password)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update password")
    
    # Clean up the token after successful password reset
    await redis_client.delete(key)
    
    return {
        "message": "Password has been reset successfully. Please log in with your new password.",
        "success": True
    }


# @app.post("/stock-predict", response_model=StockPredictionResponse)
# async def predict_stock(request: StockPredictionRequest):
#     """Predict stock prices for a given company using LangGraph agent."""
    
#     if not request.company_name or not request.company_name.strip():
#         raise HTTPException(status_code=400, detail="Company name cannot be empty")
    
#     company_name = request.company_name.strip()
    
#     if stock_agent is None:
#         raise HTTPException(status_code=503, detail="Stock Analysis Agent not initialized")
    
#     try:
#         # Run the stock analysis and get formatted results
#         result = stock_agent.analyze_stock_with_formatted_results(company_name)

#         return StockPredictionResponse(**result)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/stock-predict")
async def predict_stock(token: apiSecurity, request: StockPredictionRequest):
    """Predict stock prices for a given company using LangGraph agent."""
    if not request.ticker or not request.ticker:
        raise HTTPException(status_code=400, detail="Company name cannot be empty")
    
    company_name = request.ticker
    if stock_agent is None:
        raise HTTPException(status_code=503, detail="Stock Analysis Agent not initialized")
    
    try:
        result = stock_agent.analyze_stock_with_formatted_results(company_name)
        file_path = result.get("file_path", "") 
        if file_path:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"Successfully removed file: {file_path}")
                else:
                    print(f"File not found: {file_path}")
            except Exception as e:
                print(f"Error removing file {file_path}: {e}")

        historical_data = []
        current_date = datetime.now()
        fourteen_days_ago = current_date - timedelta(days=14)
        ticker_data = TickerSchema(ticker=company_name, exchange_symbol=request.exchange_symbol)
        period = request.period.lower()
        if period.endswith('m'):
            period = period+"o"
        result_json = await asyncio.to_thread(
            get_stock_data._run,
            ticker_data=[ticker_data],
            period=period
        )
        response_data = result_json[0]
        for data_point in response_data['historical']['data']:
            date_str = data_point.get("date")
            if date_str:
                try:
                    data_date = datetime.strptime(date_str, "%b %d, %Y")
                    if data_date >= fourteen_days_ago:
                        historical_data.append({
                            "date": data_point.get("date"),
                            "high": float(data_point.get("high", 0).replace(",", "")),
                            "low": float(data_point.get("low", 0).replace(",", "")),
                            "close": float(data_point.get("close", 0).replace(",", "")),
                            "type": "historical",
                            "ticker": company_name
                        })
                except ValueError:
                    continue

        predicted_data = []
        if result.get('prediction_results') and result['prediction_results'].get('forecast'):
            for forecast in result['prediction_results']['forecast']:
                original_date = forecast['date']
                try:
                    date_obj = datetime.strptime(original_date, '%Y-%m-%d')
                    formatted_date = date_obj.strftime('%b %d, %Y')
                except Exception as e:
                    formatted_date = original_date
                
                predicted_data.append({
                    "date": formatted_date,
                    "high": forecast['confidence_interval']['upper'],
                    "low": forecast['confidence_interval']['lower'],
                    "close": forecast['predicted_price'],
                    "type": "predicted",
                    "ticker": company_name
                })

        combined_data = historical_data + predicted_data

        return {"combined_chart": combined_data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/time-taken2")
async def check_time_taken_endpoint(session_id: Optional[str] = None, message_id: Optional[str]= None):
    messages = await mongodb.check_time_taken(session_id, message_id)
    count = 0
    tot_time = 0
    for msg in messages:
        if msg.time_taken != 0:
            tot_time = tot_time + int(msg.time_taken)
            count += 1
    return {"count": count, "total_time": tot_time, "average": tot_time / count if count > 0 else "NA"}

@app.post("/time-taken")
async def check_time_taken_endpoint(session_id: Optional[str] = None, message_id: Optional[str] = None):
    messages = await mongodb.check_time_taken(session_id, message_id)
    count = 0
    tot_time = 0
    max_time = 0
    min_time = float('inf')
    max_query = ""
    min_query = ""
    query_times = []
    
    for msg in messages:
        if msg.time_taken != 0 and msg.get('human_input'):
            time_taken = int(msg.time_taken)
            tot_time = tot_time + time_taken
            count += 1
            user_query = ""
            if hasattr(msg, 'user_query') and msg.user_query:
                user_query = msg.user_query
            elif hasattr(msg, 'human_input') and msg.human_input:
                user_query = msg.human_input.get('user_query', "NA")
            else:
                user_query = "NA"

            query_times.append({
                "query": user_query,
                "time_taken": time_taken,
                "created_at": msg.created_at,
                "message_id": str(msg._id) if hasattr(msg, '_id') else None
            })
            
            # Track max time
            if time_taken > max_time:
                max_time = time_taken
                max_query = user_query
                
            # Track min time
            if time_taken < min_time:
                min_time = time_taken
                min_query = user_query
    
    # Handle edge cases for min_time
    if count == 0 or min_time == float('inf'):
        min_time = "NA"
        min_query = "NA"
    
    return {
        "count": count,
        "total_time": tot_time,
        "average": tot_time / count if count > 0 else "NA",
        "max_time": max_time if count > 0 else "NA",
        "max_query": max_query if count > 0 else "NA",
        "min_time": min_time,
        "min_query": min_query,
        "query_times": query_times
    }

@app.post("/onboarding/{user_id}", response_model=Onboarding)
async def update_onboarding(user_id: str, request: OnboardingRequest):
    try:
        updated = await mongodb.create_or_update_onboarding(user_id, request.dict(exclude_unset=True))
        return updated
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    







##########################################################################################################################


@app.post("/canvas/process-query/", response_model=DocumentResponse)
async def process_canvas_query(request: CanvasRequest):
    """
    Enhanced Canvas Query Processing with Frontend Message ID - Updates existing message log
    """
    try:
        canvas_response = None
        
        if request.document_id:
            # Edit existing document
            canvas_response = await CanvasResponseManager.add_new_version(
                document_id=request.document_id,
                content=request.document_content,
                query=request.query,
                session_id=request.session_id,
                user_id=request.user_id
            )
        else:
            # Create new document
            canvas_response = await CanvasResponseManager.create_first_version(
                content=request.document_content,
                query=request.query,
                session_id=request.session_id,
                user_id=request.user_id
            )
        
        # 🆕 CHECK IF MESSAGE LOG ALREADY EXISTS, UPDATE OR CREATE
        existing_message_log = await MessageLog.find_one(
            MessageLog.message_id == request.message_id,
            MessageLog.session_id == request.session_id
        )
        
        if existing_message_log:
            # Update existing message log
            existing_message_log.human_input = {
                "type": "canvas_query",
                "user_query": request.query
            }
            existing_message_log.response = {
                "type": "canvas_response",
                "canvas_id": canvas_response.document_id,
                "content": request.document_content[:200] + "..." if len(request.document_content) > 200 else request.document_content,
                "canvas_version_number": canvas_response.current_version,
                "processing_successful": True
            }
            existing_message_log.canvas_document_id = canvas_response.document_id
            existing_message_log.error = None  # Clear any previous errors
            existing_message_log.created_at = datetime.now(timezone.utc)  # Update timestamp
            
            # Save updated message log
            await existing_message_log.save()
            log_action = "updated"
        else:
            # Create new message log entry
            message_log = MessageLog(
                session_id=request.session_id,
                message_id=request.message_id,
                human_input={
                    "type": "canvas_query",
                    "user_query": request.query
                },
                response={
                    "type": "canvas_response",
                    "canvas_id": canvas_response.document_id,
                    "content": request.document_content[:200] + "..." if len(request.document_content) > 200 else request.document_content,
                    "canvas_version_number": canvas_response.current_version,
                    "processing_successful": True
                },
                canvas_document_id=canvas_response.document_id,
                created_at=datetime.now(timezone.utc)
            )
            
            # Save new message log
            await message_log.insert()
            log_action = "created"
        
        # Get current version data for response
        current_version_data = canvas_response.get_current_version_data()
        
        return DocumentResponse(
            document_id=canvas_response.document_id,
            version_number=current_version_data.version_number,
            query=current_version_data.query,
            final_content=current_version_data.final_content,
            is_current=current_version_data.is_current,
            can_edit=True,
            created_at=current_version_data.created_at,
            message=f"Document processed successfully. Version: {current_version_data.version_number}. Message log {log_action}: {request.message_id}"
        )
        
    except ValueError as e:
        
        raise HTTPException(status_code=400, detail=str(e))
    

@app.get("/canvas-latest-version/{document_id}", response_model=DocumentResponse)
async def get_current_document(document_id: str):
    """Get current version of a document"""
    try:
        canvas_response = await CanvasResponseManager.get_canvas_response(document_id)
        current_version_data = canvas_response.get_current_version_data()

        if not current_version_data:
            raise ValueError("No current version found")
        
        # Check if can edit (current version is the latest)
        can_edit = current_version_data.version_number == canvas_response.total_versions
        
        return DocumentResponse(
            document_id=canvas_response.document_id,
            version_number=current_version_data.version_number,
            query=current_version_data.query,
            final_content=current_version_data.final_content,
            is_current=current_version_data.is_current,
            can_edit=can_edit,
            created_at=current_version_data.created_at,
            message="Current document version retrieved"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/canvas-all-versions/{document_id}/history", response_model=DocumentHistory)
async def get_document_history(document_id: str):
    """Get complete version history of a document"""
    try:
        canvas_response = await CanvasResponseManager.get_canvas_response(document_id)
        
        versions = [
            VersionInfo(
                version_number=v.version_number,
                query=v.query,
                final_content=v.final_content,
                created_at=v.created_at,
                is_current=v.is_current,
                can_edit=(v.is_current and v.version_number == canvas_response.total_versions),
                processing_time_ms=v.processing_time_ms
            )
            for v in canvas_response.versions
        ]
        
        return DocumentHistory(
            document_id=canvas_response.document_id,
            current_version_number=canvas_response.current_version,
            total_versions=canvas_response.total_versions,
            versions=versions
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/canvas-get-version/{document_id}/version/{version_number}")
async def view_specific_version(document_id: str, version_number: int):
    """View a specific version of a document"""
    try:
        canvas_response = await CanvasResponseManager.get_canvas_response(document_id)
        version_data = canvas_response.get_version_by_number(version_number)
        
        if not version_data:
            raise ValueError(f"Version {version_number} not found")
        
        can_edit = version_data.is_current and version_data.version_number == canvas_response.total_versions
        
        return {
            "document_id": canvas_response.document_id,
            "version_number": version_data.version_number,
            "query": version_data.query,
            "final_content": version_data.final_content,
            "original_content": version_data.original_content,
            "created_at": version_data.created_at,
            "is_current": version_data.is_current,
            "can_edit": can_edit,
            "processing_time_ms": version_data.processing_time_ms,
            "message": "Editable current version" if can_edit else "Read-only previous version"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/canvas-make-latest-version/{document_id}/make-version-latest/{version_number}")
async def make_version_current_with_logging(
    document_id: str, 
    version_number: int, 
    request: VersionActionRequest
):
    """Enhanced Make Version Current with Frontend Message ID - Updates existing message log"""
    try:
        canvas_response, deleted_count = await CanvasResponseManager.make_version_current(document_id, version_number)
        current_version_data = canvas_response.get_current_version_data()
        
        # 🆕 UPDATE OR CREATE MESSAGE LOG
        log_action = await mongodb.update_or_create_message_log(
                session_id=request.session_id,
                message_id=request.message_id,
                human_input={
                    "type": "canvas_query",
                    "user_query": request.query
                },
                response={
                    "type": "canvas_response",
                    "canvas_id": canvas_response.document_id,
                    "content": request.document_content[:200] + "..." if len(request.document_content) > 200 else request.document_content,
                    "canvas_version_number": canvas_response.current_version,
                    "processing_successful": True
                },
                canvas_document_id=canvas_response.document_id
        )
        
        message_parts = [f"Version {version_number} is now current and editable"]
        if deleted_count > 0:
            message_parts.append(f"Deleted {deleted_count} subsequent version(s)")
        
        return {
            "message": ". ".join(message_parts),
            "document_id": canvas_response.document_id,
            "version_number": current_version_data.version_number,
            "query": current_version_data.query,
            "final_content": current_version_data.final_content,
            "is_current": True,
            "can_edit": True,
            "total_versions": canvas_response.total_versions,
            "deleted_versions_count": deleted_count,
            "warning": "All versions after this version have been permanently deleted" if deleted_count > 0 else None,
            "message_id": request.message_id,
            "log_action": log_action  # Shows if message was "updated" or "created"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    

@app.get("/canvas-preview/documents/")
async def list_documents(session_id: str = None, user_id: str = None):
    """List all canvas response documents"""
    try:
        canvas_responses = await CanvasResponseManager.list_canvas_responses(session_id, user_id)
        
        documents = []
        for doc in canvas_responses:
            current_version_data = doc.get_current_version_data()
            documents.append(DocumentListItem(
                document_id=doc.document_id,
                current_version=doc.current_version,
                total_versions=doc.total_versions,
                created_at=doc.created_at,
                updated_at=doc.updated_at,
                user_id=doc.user_id,
                session_id=doc.session_id,
                current_query=current_version_data.query if current_version_data else "",
                content_preview=(current_version_data.final_content[:200] + "..." 
                               if current_version_data and len(current_version_data.final_content) > 200 
                               else current_version_data.final_content if current_version_data else "")
            ))
        
        return {
            "documents": documents,
            "total_count": len(documents)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")

@app.delete("/canvas-delete/{document_id}")
async def delete_document(document_id: str):
    """Delete a canvas response document"""
    try:
        await CanvasResponseManager.delete_canvas_response(document_id)
        return {"message": f"Document {document_id} deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/canvas-upload-markdown/")
async def upload_markdown_file_with_logging(
    file: UploadFile = File(...),
    message_id: str = Form(..., description="Message ID from frontend"),  # 🆕 REQUIRED
    session_id: str = Form(..., description="Session ID"),
    user_id: str = Form(None, description="User ID")
):
    """Enhanced Markdown Upload with Frontend Message ID"""
    try:
        # Validate file type
        if not file.filename.endswith(('.md', '.markdown', '.txt')):
            raise HTTPException(status_code=400, detail="Only markdown (.md, .markdown) and text (.txt) files are supported")
        
        # Read file content
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Process markdown content
        processed_content = process_markdown_content(content_str)
        
        # Create first version with upload query
        canvas_response = await CanvasResponseManager.create_first_version(
            content=processed_content,
            query=f"Initial markdown upload: {file.filename}",
            session_id=session_id,
            user_id=user_id
        )
        
        # 🆕 USE FRONTEND PROVIDED MESSAGE ID
        message_log = MessageLog(
            session_id=session_id,
            message_id=message_id,  # 🆕 Use frontend provided message_id
            human_input={
                "type": "file_upload",
                "filename": file.filename,
                "file_size": len(content_str),
                "file_type": "markdown",
                "content_preview": content_str[:300] + "..." if len(content_str) > 300 else content_str
            },
            response={
                "type": "file_upload_response",
                "document_id": canvas_response.document_id,
                "processing_successful": True,
                "content_processed": True
            },
            canvas_document_id=canvas_response.document_id,  # 🆕 Link to canvas document
            created_at=datetime.now(timezone.utc)
        )
        await message_log.insert()
        
        current_version_data = canvas_response.get_current_version_data()
        
        return {
            "document_id": canvas_response.document_id,
            "version_number": current_version_data.version_number,
            "query": current_version_data.query,
            "final_content": current_version_data.final_content,
            "is_current": current_version_data.is_current,
            "can_edit": True,
            "created_at": current_version_data.created_at.isoformat(),
            "message": f"Markdown file uploaded successfully. Document ID: {canvas_response.document_id}",
            "message_id": message_id  # 🆕 Return frontend message_id
        }
        
    except Exception as e:
        # Log error with frontend message_id
        error_log = MessageLog(
            session_id=session_id,
            message_id=message_id,  # 🆕 Use frontend provided message_id
            human_input={
                "type": "file_upload",
                "filename": file.filename if file else "unknown",
                "attempted_action": "markdown_upload"
            },
            error={
                "type": "file_upload_error",
                "error_message": str(e),
                "error_code": "processing_error"
            },
            created_at=datetime.now(timezone.utc)
        )
        await error_log.insert()
        
        raise HTTPException(status_code=400, detail=f"Error uploading markdown file: {str(e)}")



@app.get("/canvas_document/{document_id}/download")
async def download_document(document_id: str, version_number: Optional[int] = None):
    """Download a document as a markdown file"""
    try:
        canvas_response = await CanvasResponseManager.get_canvas_response(document_id)
        
        if version_number:
            version_data = canvas_response.get_version_by_number(version_number)
            if not version_data:
                raise ValueError(f"Version {version_number} not found")
            content = version_data.final_content
        else:
            current_version_data = canvas_response.get_current_version_data()
            if not current_version_data:
                raise ValueError("No current version found")
            content = current_version_data.final_content
        
        # Create temporary file for download
        temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.md', encoding='utf-8')
        temp_file.write(content)
        temp_file.close()
        
        filename = f"canvas_response_{document_id}_v{version_number or 'current'}.md"
        
        return FileResponse(
            path=temp_file.name,
            filename=filename,
            media_type='text/markdown'
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/{url:path}")
async def chat_redirect(url: str):
    try:
        if url.startswith("public/") and os.path.exists(url):
            return FileResponse(url)
    except Exception as e:
        print(f"Error checking or serving {url}: {e}")

    try:
        if os.path.exists(f"out/{url}"):
            return FileResponse(f"out/{url}")
    except Exception as e:
        print(f"Error checking or serving out/{url}: {e}")

    try:
        if os.path.exists(f"out/{url}.html"):
            return FileResponse(f"out/{url}.html")
    except Exception as e:
        print(f"Error checking or serving out/{url}.html: {e}")

    try:
        if os.path.exists(f"out/{url}.txt"):
            return FileResponse(f"out/{url}.txt")
    except Exception as e:
        print(f"Error checking or serving out/{url}.txt: {e}")

    return Response(status_code=status.HTTP_404_NOT_FOUND)

if __name__ == "__main__":
    import uvicorn
    asyncio.run(mongodb.init_db())
    uvicorn.run(app, host="0.0.0.0", port=8000)
