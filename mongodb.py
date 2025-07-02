import asyncio
import os
import json
import re
import time
import uuid
from datetime import datetime, timezone
# from bson import ObjectId
from bson.binary import Binary
from beanie import Document, init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import DESCENDING, MongoClient
from pydantic import Field, BaseModel
from typing import Any, List, Optional, Literal, Dict
from beanie.odm.fields import PydanticObjectId
from enum import Enum
from beanie.operators import Or, And
import JWT
from typing import Optional, Dict
from jose import JWTError
from fastapi import HTTPException, UploadFile
from zoneinfo import ZoneInfo
from typing import Optional

from canvas_processor import full_pipeline_api
from schemas.app_io import Onboarding
from agents.utils import generate_session_title
from azure.storage.blob import BlobServiceClient

MONGO_URI = os.getenv("MONGO_URI")

jwt_handler = None


class AuthMethod(str, Enum):
    LOCAL = "local"
    GOOGLE = "google"
    OUTLOOK = "outlook"


class AccountStatus(str, Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'


class Users(Document):
    email: str
    full_name: str
    password: Optional[str] = None
    profile_picture: Optional[str] = None
    auth_provider: AuthMethod = AuthMethod.LOCAL
    account_status: AccountStatus = AccountStatus.ACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        collection = "users"

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            PydanticObjectId: str,
            datetime: lambda v: v.isoformat(),
        }

    def to_dict(self) -> dict:
        """Convert model instance to dictionary with proper serialization"""
        data = self.model_dump(exclude={"password"})
        data["_id"] = str(self.id) if hasattr(self, "id") and self.id else None
        data["created_at"] = self.created_at.isoformat(
        ) if self.created_at else None
        data["last_updated"] = self.last_updated.isoformat(
        ) if self.last_updated else None
        return data

class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    profile_picture: Optional[str] = None


class Personalization(Document):
    user_id: PydanticObjectId
    introduction: Optional[str] = None
    location: Optional[str] = None
    language: Optional[str] = "English"
    preferred_response_language: Optional[str] = "Automatic"
    autosuggest: bool = True
    email_notifications: bool = False
    ai_data_retention: bool = False
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


    class Settings:
        collection = "personalization"

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            PydanticObjectId: str,
            datetime: lambda v: v.isoformat(),
        }

class PersonalizationRequest(BaseModel):
    introduction: Optional[str] = None
    location: Optional[str] = None
    language: Optional[str] = None
    preferred_response_language: Optional[str] = None
    autosuggest: Optional[bool] = None
    email_notifications: Optional[bool] = None
    ai_data_retention: Optional[bool] = None


class returnStatus(BaseModel):
    status: bool
    message: str
    result: Optional[Dict] = None

    def to_dict(self) -> dict:
        """Convert model instance to dictionary with proper serialization"""
        return self.model_dump(exclude_none=True)  # Exclude None values for cleaner output


class MessageLog(Document):
    session_id: str = Field(...)
    message_id: str = Field(...)
    human_input: Optional[dict] = None
    research: Optional[List[dict]] = []
    response: Optional[dict] = None
    sources: Optional[List[dict]] = None
    error: Optional[dict] = None
    stock_chart: Optional[List[dict]] = []
    map_layers: Optional[dict] = None
    metadata: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    time_taken: Optional[int] = 0
    canvas_document_id: Optional[str] = None

    class Settings:
        collection = "log_entries"


class MessageFeedback(Document):
    message_id: str = Field(...)
    response_id: str = Field(...)
    liked: Optional[bool] = None
    feedback_tag: Optional[List[List[str]]] = []
    human_feedback: Optional[List[str]] = []

    class Settings:
        collection = "message_feedback"


class AccessLevel(str, Enum):
    PUBLIC = 'public'
    PRIVATE =  'private'


class SessionLog(Document):
    user_id: PydanticObjectId
    session_id: str = Field(...)
    title: str = Field(...)
    access_level: AccessLevel = AccessLevel.PRIVATE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    timezone: Optional[str] = "UTC"
    visible: Optional[bool] = True

    class Settings:
        collection = "sessions"

    def to_dict(self) -> dict:
        """Convert model instance to dictionary with proper serialization"""
        data = self.dict()
        data["_id"] = str(self.id) if hasattr(self, "id") and self.id else None
        data["user_id"] = str(self.user_id)
        return data


class SessionHistory(Document):
    user_id: PydanticObjectId
    session_id: str = Field(...)
    title: Optional[str] = "New Chat"
    history: List[dict] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        collection = "session_histories"

    def to_dict(self) -> dict:
        data = self.model_dump()
        data["_id"] = str(self.id)
        data["user_id"] = str(self.user_id)
        return data


class MessageOutput(Document):
    user_id: PydanticObjectId
    session_id: str = Field(...)
    message_id: str = Field(...)
    state_data: Dict[str, Any]
    status: str = Field(...)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        collection = "message_outputs"

    def to_dict(self) -> dict:
        data = self.model_dump()
        data["_id"] = str(self.id)
        data["user_id"] = str(self.user_id)
        return data


class JSONBackup(Document):
    filename: str
    data: dict
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        collection = "json_backup"


class CurrencyRates(BaseModel):
    symbols: str
    created_at: datetime


class SemiStaticData(Document):
    currency_rates: CurrencyRates = Field(...)

class ExternalData(Document):
    filename: str
    data: Any
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    class Settings:
        collection = "external_data"


class GraphLog(Document):
    session_id: str
    message_id: str
    logs: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "graph_logs"


class MapData(Document):
    session_id: str = Field(...)
    message_id: str = Field(...)
    data: Dict[str, Any] = Field(...)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        collection = "map_data"


class UploadResponse(Document):
    file_id: str
    original_filename: Optional[str] = None
    blob: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        collection = "user_uploads"

        
async def init_db():
    global jwt_handler, MONGO_URI
    client = AsyncIOMotorClient(MONGO_URI)
    database = client["insight_agent"]
    jwt_handler = JWT.JWTHandler("f524fdd634e89fd7a3d886564d026666b3ea46db9c77a57d68309f02190020cb", "HS256", "30")
    await init_beanie(database=database, document_models=[MessageLog, JSONBackup, SessionLog, Users, MessageFeedback, ExternalData, SessionHistory, MessageOutput, MapData, GraphLog, Personalization, Onboarding, CanvasResponse, UploadResponse])

async def init_web_search_db():
    client = AsyncIOMotorClient(MONGO_URI)
    database = client["insight_agent"]
    await init_beanie(database=database, document_models=[ExternalData])

async def create_user(user_data: dict) -> Users:
    user = Users(**user_data)
    user.account_status = AccountStatus.ACTIVE
    us = await user.insert()
    return user


async def get_user(email: str) -> Optional[Users]:
    email_match = And(Users.email == email, Users.account_status == AccountStatus.ACTIVE)
    user = await Users.find_one(email_match)
    return user


async def deactivate_user_service(user_id: str) -> str:
    user = await Users.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.account_status == AccountStatus.INACTIVE:
        return "User is already inactive."

    user.account_status = AccountStatus.INACTIVE
    #user.account_status = "inactive"
    await user.save()
    return f"User {user_id} deactivated successfully."


async def fetch_user_by_id(user_id: str) -> Optional[Users]:
    id_match = And(Users.id == PydanticObjectId(user_id), Users.account_status == AccountStatus.ACTIVE)
    user = await Users.find_one(id_match)
    return user.to_dict() if user else None


async def get_user_by_id(token: str) -> returnStatus:
    try:
        payload = jwt_handler.decode_jwt(token)
        user_id = payload.get("user_id")
        user = await fetch_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def append_data(user_id, session_id, message_id, messages, local_time, time_zone, metadata = None, time_taken = 0):
    from utils import get_unique_response_id, get_date_time
    try:
        log_entry = await MessageLog.find_one({"session_id": str(session_id), "message_id": str(message_id)})
        if not log_entry:
            log_entry = MessageLog(session_id=str(session_id), message_id=str(message_id))
        else:
            log_entry.research = []
            log_entry.stock_chart = []

        if metadata:
            log_entry.metadata = metadata

        if time_taken:
            log_entry.time_taken = time_taken

        for content in messages:
            if 'user_query' in content:
                log_entry.human_input = content

            elif 'type' in content and content['type'] == 'research':
                if content['agent_name'] != "DB Search Agent":
                    log_entry.research.append({'agent_name': content['agent_name'], 'title': content['title'], 'id': content['id'] or "run-123", 'created_at': content['created_at']})
            
            elif 'research-manager' in content:
                log_entry.research.append({'agent_name': content['agent_name'], 'title': content['research-manager'], 'id': content['id'], 'created_at': content['created_at']})
            
            elif 'response' in content:
                log_entry.response = {'agent_name': content['agent_name'], 'content': content['response'], 'id': content['id'], 'created_at': content['created_at']}

            elif 'type' in content and content['type'] == 'response':
                log_entry.response = {'agent_name': content['agent_name'], 'content': content['content'], 'id': content['id'], 'created_at': content['created_at']}

            elif 'type' in content and content['type'] == 'stock_data':
                data = content['data']
                symbol = data['realtime']['symbol']
                timestamp = data['realtime']['timestamp']

                already_exists = any(
                    d['realtime']['symbol'] == symbol and d['realtime']['timestamp'] == timestamp
                    for d in log_entry.stock_chart
                )
                if not already_exists:
                    log_entry.stock_chart.append(data)

            elif 'type' in content and content['type'] == 'map_layers':
                log_entry.map_layers.append(content['data'])

            elif 'sources' in content:
                log_entry.sources = content['sources']
            
            elif "error" in content:
                log_entry.error = content

        if not log_entry.response:
            log_entry.response = {'agent_name': 'Response Generator Agent', 'content': '**There was an error generating the response**', 'id': get_unique_response_id(), 'created_at': get_date_time().isoformat()}

        log_entry.created_at = local_time
        lg = await log_entry.save()

        print(f"Added session {session_id}, message {message_id} to db.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error in storing message log: {str(e)}")


async def append_graph_log_to_mongo(session_id: str, message_id: str, log: str):
    existing_log = await GraphLog.find_one({"session_id": session_id, "message_id": message_id})
    if existing_log:
        existing_log.logs += f"\n{'='*15}\n\n{log}"
        await existing_log.save()
    else:
        new_log = GraphLog(session_id=session_id, message_id=message_id, logs=log)
        await new_log.insert()


async def add_session(session_id, title, local_time, time_zone, user_id=None):
    session = await SessionLog.find_one({"session_id": session_id})

    if not session:
        session = SessionLog(
            user_id=PydanticObjectId(user_id),
            session_id=session_id,
            title=title,
            access_level=AccessLevel.PRIVATE,
            created_at= local_time,
            timezone= time_zone if timezone else "UTC",
            visible=True
        )
        await session.insert()
        print(f"Created new session with title")


async def get_sessions_by_user(user_id: str) -> List[dict]:
    await init_db()
    
    sessions = await SessionLog.find({"user_id": PydanticObjectId(user_id),"visible": True}).to_list()
    serialized_sessions = []
    
    for session in sessions:
        serialized_sessions.append({
            "id": str(session.session_id),
            "user_id": str(session.user_id),
            "title": session.title.title(),
            "created_at": session.created_at.isoformat()
        })

    sorted_sessions = sorted(
        serialized_sessions, key=lambda x: x["created_at"], reverse=True)

    if bool(sorted_sessions) == False :
        return None
    
    if sorted_sessions[0].get("timezone"):
        tz = ZoneInfo(sorted_sessions[0].get("timezone"))
    else:
        tz = ZoneInfo("UTC")
    
    current_date = datetime.now(tz).date()
    
    categorized_data = {
        "Today": [],
        "Previous 7 days": [],
        "Previous 30 days": [],
    }
    
    # Process each session
    for session in sorted_sessions:
        # Convert ISO string to datetime object
        created_date = datetime.fromisoformat(session["created_at"]).date()
        
        days_diff = (current_date - created_date).days
        
        if days_diff == 0:
            categorized_data["Today"].append(session)
        elif 1 <= days_diff <= 7:
            categorized_data["Previous 7 days"].append(session)
        elif 8 <= days_diff <= 30:
            categorized_data["Previous 30 days"].append(session)
        else:
            if created_date.year == current_date.year:
                month_name = created_date.strftime("%B")
                if month_name not in categorized_data:
                    categorized_data[month_name] = []
                categorized_data[month_name].append(session)
            else:
                year_month = f"{created_date.strftime('%B')} {created_date.year}"
                if year_month not in categorized_data:
                    categorized_data[year_month] = []
                categorized_data[year_month].append(session)
    
    result = []
    for timeline, sessions in categorized_data.items():
        if sessions:
            result.append({
                "timeline": timeline,
                "data": sessions
            })
    
    return result


async def get_session_log_by_user_and_session_id(user_id: str, session_id: str) -> Optional[SessionLog]:
    session_log = await SessionLog.find_one({"user_id": PydanticObjectId(user_id), "session_id": session_id, "visible": True})
    return session_log

async def get_msglog_by_msgid(message_id: str):
    return await MessageLog.find_one({"message_id": message_id})

async def get_messages_by_session(session_id: str) -> List[dict]:
    logs = await MessageLog.find({"session_id": session_id}, sort=[("created_at", 1)]).to_list()
    try:
        session_messages = {"session_id": session_id, 'message_list': [
        ]}
        for log in logs:
            research_data = log.research if log.research else None
            if (research_data and isinstance(research_data, list) and len(research_data) > 0 and 'created_at' in research_data[0]):
                research_data = sorted(research_data, key=lambda x: x['created_at'])

            
            feedback = await MessageFeedback.find_one({"message_id": log.message_id})
            feedback_data = {
                "liked": "yes" if feedback and feedback.liked is True else "no" if feedback and feedback.liked is False else None,
                "feedback_tag": feedback.feedback_tag if feedback else [],
                "human_feedback": feedback.human_feedback if feedback else []
            }
            
            doc_info_list = []
            if log.human_input and isinstance(log.human_input, dict):
                doc_ids = log.human_input.get("doc_ids", [])
                if doc_ids:
                    for file_id in doc_ids:
                        doc = await UploadResponse.find_one({"file_id": file_id})
                        if doc:
                            file_name = doc.original_filename
                            if file_name and "." in file_name:
                                file_type = file_name.split(".")[-1]
                            else:
                                file_type = "unknown"

                            doc_info_list.append({
                                "file_id": file_id,
                                "file_name": file_name or "unknown",
                                "file_type": file_type
                            })
                
            session_messages["message_list"].append({
                "message_id": log.message_id,
                "human_input": log.human_input,
                "doc_info": doc_info_list,
                "research": research_data,
                "response": log.response,
                "stock_chart": log.stock_chart if log.stock_chart else [],
                "map_layers": log.map_layers,
                "sources": log.sources if log.sources else [],
                "created_at": log.created_at.isoformat(),
                "feedback": feedback_data 
            })

        return session_messages
    except Exception as e:
        error = f"Error occurred in getting previous session: {str(e)}"
        print(error)
        raise e



async def get_response_by_message_id(message_id: str) -> dict:
    log = await MessageLog.find_one({"message_id": str(message_id)})
    if log:
        response = {'query': log.human_input.get('user_query'), 'response': log.response.get('content')}
        return response
    else:
        return {'error': 'Not found.'}


async def add_response_feedback(message_id: str, response_id: str, liked: bool = None, feedback_tag: str = None, human_feedback: str = None):
    try:
        response_feedback = await MessageFeedback.find_one({
            "message_id": message_id,
            "response_id": response_id
        })

        if not response_feedback:
            response_feedback = MessageFeedback(
                message_id=message_id, response_id=response_id)
        else:
            if liked is not None:
                response_feedback.liked = liked
            if feedback_tag:
                if not response_feedback.feedback_tag:
                    response_feedback.feedback_tag = []
                response_feedback.feedback_tag.append(feedback_tag)
            if human_feedback:
                if not response_feedback.human_feedback:
                    response_feedback.human_feedback = []
                response_feedback.human_feedback.append(human_feedback)


        rf = await response_feedback.save()

        return f"Saved response feedback: {rf}"
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Encountered error in adding response feedback: {str(e)}")
        raise e


async def change_session_access_level(session_id: str, user_id: str, access_level: str):
    session = await SessionLog.find_one({"session_id": session_id, "user_id": PydanticObjectId(user_id), "visible": True})

    if not session:
        raise HTTPException(status_code=404, detail="Session not found or you don't have permission to modify it")

    session.access_level = access_level
    session.updated_at = datetime.now(timezone.utc)

    await session.save()

    return {"status": "success", "session_id": session_id}


async def check_public_session(session_id: str):
    session = await SessionLog.find_one({"session_id": session_id, "access_level": 'public', "visible": True})
    if not session:
        return False
    return True

async def update_user_password(email: str, new_hashed_password: str) -> bool:
    user = await Users.find_one(Users.email == email)
    if not user:
        return False

    await user.set({Users.password: new_hashed_password})
    return True


def insert_in_db(file_data: list):
    try:
        client = MongoClient(MONGO_URI)
        collection = client['insight_agent']['ExternalData']

        records = [{'filename': indi_file['filename'], 'data': indi_file['data']} for indi_file in file_data]
        collection.insert_many(records)
        print("data inserted")
    except Exception as e:
        print(f"MongoDB bulk insert error: {str(e)}")


async def fetch_by_filename(filename: str):
    try:
        result = await ExternalData.find_one({"filename": filename})
        print(filename)
        return result
    except Exception as e:
        print(f"MongoDB fetch error: {str(e)}")
        return None


async def update_session_history_in_db(session_id: str, user_id: str, message_id: str, user_query: str, assistant_response: str, local_time: Optional[datetime], time_zone: Optional[str]):
    from utils import get_date_time

    user_object_id = PydanticObjectId(user_id)
    session = await SessionHistory.find_one(SessionHistory.session_id == session_id, SessionHistory.user_id == user_object_id)

    message_entry = {message_id: (user_query, assistant_response)}

    if not session:
        session = SessionHistory(
            user_id=user_object_id,
            session_id=session_id,
            title="New Chat",
            history=[message_entry],
            created_at=local_time,
            updated_at=local_time,
        )

        title = await generate_title(session.history)
        session.title = title
        await session.insert()
        await add_session(session_id, title, local_time, time_zone, user_id)

    else:
        message_found = False
        for entry in reversed(session.history):
            if message_id in entry:
                entry[message_id] = (user_query, assistant_response)
                message_found = True
                break

        if not message_found:
            session.history.append(message_entry)

        if not session.title or session.title == "New Chat":
            title = await generate_title(session.history)
            if title and title != "New Chat":
                session.title = title

                session_log = await SessionLog.find_one(SessionLog.session_id == session_id, SessionLog.user_id == user_object_id)
                if session_log:
                    session_log.title = title
                    await session_log.save()
        session.updated_at = local_time
        await session.save()


async def get_session_history_from_db(session_id: str, prev_message_id: str, limit: int = None) -> List[List[str]]:
    session = await SessionHistory.find_one(SessionHistory.session_id == session_id)
    all_messages = []
    if session:
        collecting = False
        for entry in reversed(session.history):
            if prev_message_id in entry:
                collecting = True
            
            if collecting:
                message = list(entry.values())[0]
                all_messages.append(message)

                if limit and len(all_messages) >= limit:
                    break

        all_messages.reverse()
        return all_messages
    return []


async def get_previous_deep_research_state(session_id: str, prev_message_id: str) -> Optional[Dict[str, Any]]:
    msg = await MessageOutput.find_one(
        MessageOutput.session_id == session_id,
        MessageOutput.message_id == prev_message_id,
        MessageOutput.status == "awaiting_feedback",
    )
    return msg.state_data if msg else None


async def store_deep_research_state(user_id: str, session_id: str, message_id: str, state_data: Dict[str, Any]):
    msg = await MessageOutput.find_one(MessageOutput.session_id == session_id, MessageOutput.message_id == message_id)

    if not msg:
        msg = MessageOutput(
            user_id=PydanticObjectId(user_id),
            session_id=session_id,
            message_id=message_id,
            state_data=state_data,
            status="awaiting_feedback",
        )
        await msg.insert()

    else:
        msg.state_data = state_data
        msg.status = "awaiting_feedback"
        msg.updated_at = datetime.now(timezone.utc)
        await msg.save()


async def insert_map_data(session_id: str, message_id: str, data: Dict[str, Any]):
    try:
        record = MapData(
            session_id=session_id,
            message_id=message_id,
            data=data,
        )
        await record.insert()
    except Exception as e:
        print(f"MongoDB insert error (MapData): {str(e)}")


async def fetch_map_data(message_id: str):
    try:
        result = await MapData.find_one({"message_id": message_id})
        return result.data
    except Exception as e:
        print(f"MongoDB fetch error (MapData): {str(e)}")
        return None


async def get_user_details(user_id: str) -> Optional[Users]:
    try:
        user = await Users.get(PydanticObjectId(user_id))

        if user and user.account_status == "active":
            return user
        return None
    except Exception as e:
        print(f"Error fetching user: {e}")
        return None


async def update_user_profile(user_id: str, full_name: Optional[str], email: Optional[str], profile_picture: Optional[str]) -> Optional[Users]:
    user = await Users.get(PydanticObjectId(user_id))
    if not user:
        return None

    if full_name is not None:
        user.full_name = full_name
    if email is not None:
        user.email = email
    if profile_picture is not None:
        user.profile_picture = profile_picture

    user.last_updated = datetime.now()
    await user.save()
    return user


async def get_personalization(user_id: str) -> Optional[Personalization]:
    try:
        return await Personalization.find_one(Personalization.user_id == PydanticObjectId(user_id))
    except Exception as e:
        print(f"Error in get_personalization: {e}")
        return None

async def create_or_update_personalization(user_id: str, data: dict) -> Personalization:
    try:
        personalization = await get_personalization(user_id)
        if personalization:
            for key, value in data.items():
                setattr(personalization, key, value)
            personalization.last_updated = datetime.now(timezone.utc)
            await personalization.save()
        else:
            personalization = Personalization(
                user_id=PydanticObjectId(user_id),
                **data
            )
            await personalization.insert()
        return personalization
    except Exception as e:
        print(f"Error in create_or_update_personalization: {e}")
        raise

async def get_sessions_by_user_and_keyword(user_id: str, keyword: str) -> List[Dict]:
    await init_db()

    print('2')
    
    regex = re.compile(re.escape(keyword), re.IGNORECASE)
    print('3')
    sessions = await SessionHistory.find({
        "user_id": PydanticObjectId(user_id),
        "title": {"$regex": regex}
    }).to_list()

    print('sssss', sessions)

    if not sessions:
        return []  # Let API decide how to handle "no match"
    
    # Serialize sessions
    serialized = [
        {
            "id": str(s.session_id),
            "user_id": str(s.user_id),
            "title": s.title.title(),
            "created_at": s.created_at.isoformat(),
            "timezone": getattr(s, "timezone", None)
        }
        for s in sessions
    ]

    # Sort newest → oldest
    serialized.sort(key=lambda x: x["created_at"], reverse=True)

    # Timezone handling
    tz = ZoneInfo(serialized[0].get("timezone") or "UTC")
    current_date = datetime.now(tz).date()

    # Timeline buckets
    buckets: Dict[str, List[Dict]] = {
        "Today": [],
        "Previous 7 days": [],
        "Previous 30 days": [],
    }

    for s in serialized:
        created_date = datetime.fromisoformat(s["created_at"]).date()
        days_diff = (current_date - created_date).days

        if days_diff == 0:
            buckets["Today"].append(s)
        elif 1 <= days_diff <= 7:
            buckets["Previous 7 days"].append(s)
        elif 8 <= days_diff <= 30:
            buckets["Previous 30 days"].append(s)
        else:
            key = (
                created_date.strftime("%B")
                if created_date.year == current_date.year
                else f"{created_date.strftime('%B')} {created_date.year}"
            )
            buckets.setdefault(key, []).append(s)

    # Final response structure
    return [
        {"timeline": tl, "data": data}
        for tl, data in buckets.items() if data
    ]
    
# async def get_sessions_by_user_and_keyword2(user_id: str, keyword: str) -> List[Dict]:
#     await init_db()
#     regex = re.compile(re.escape(keyword), re.IGNORECASE)

#     histories: List[SessionHistory] = await SessionHistory.find({
#         "user_id": PydanticObjectId(user_id)
#     }).to_list()

#     matched_session_ids = set()
#     for hist in histories:
#         for entry in hist.history:
#             found = False
#             for v in entry.values():
#                     # case A: v is a string
#                 if isinstance(v, str) and regex.search(v):
#                     found = True
#                     break

#             # case B: v is a list/tuple of strings, scan inside
#                 if isinstance(v, (list, tuple)):
#                     for item in v:
#                         if isinstance(item, str) and regex.search(item):
#                             found = True
#                             break
#                 if found:
#                     break

#             if found:
#                 matched_session_ids.add(hist.session_id)
#                 break

#     # 3) now query SessionLog for either title-matches or those session_ids
#     or_clauses = [
#         {"title": {"$regex": regex}}
#     ]
#     if matched_session_ids:
#         or_clauses.append({"session_id": {"$in": list(matched_session_ids)}})

#     sessions: List[SessionLog] = await SessionLog.find({
#         "user_id": PydanticObjectId(user_id),
#         "visible": True,
#         "$or": or_clauses
#     }).to_list()

#     if not sessions:
#         return []

#     # 4) build a map from session_id → history array for easy lookup
#     history_map = {
#         hist.session_id: hist.history
#         for hist in histories
#         if hist.session_id in matched_session_ids
#     }

#     # 5) serialize the sessions + merge in the history[]
#     serialized = []
#     for s in sessions:
#         serialized.append({
#             "id": str(s.session_id),
#             "user_id": str(s.user_id),
#             "title": s.title.title(),
#             "created_at": s.created_at.isoformat(),
#             "timezone": getattr(s, "timezone", None),
#             # default to empty list if we never saw a history match for this session
#             "history": history_map.get(s.session_id, []),
#         })

#     # 6) sort newest → oldest
#     serialized.sort(key=lambda x: x["created_at"], reverse=True)

#     # 7) bucket by “Today” / “Previous 7 days” / “Previous 30 days” / older
#     tz = ZoneInfo(serialized[0].get("timezone") or "UTC")
#     today = datetime.now(tz).date()

#     buckets: Dict[str, List[Dict]] = {
#         "Today": [],
#         "Previous 7 days": [],
#         "Previous 30 days": [],
#     }
#     for s in serialized:
#         created = datetime.fromisoformat(s["created_at"]).date()
#         delta = (today - created).days

#         if delta == 0:
#             buckets["Today"].append(s)
#         elif 1 <= delta <= 7:
#             buckets["Previous 7 days"].append(s)
#         elif 8 <= delta <= 30:
#             buckets["Previous 30 days"].append(s)
#         else:
#             # group by month (and year if not current year)
#             if created.year == today.year:
#                 key = created.strftime("%B")
#             else:
#                 key = f"{created.strftime('%B')} {created.year}"
#             buckets.setdefault(key, []).append(s)

#     # 8) return only the non-empty timelines
#     return [
#         {"timeline": tl, "data": data}
#         for tl, data in buckets.items() if data
#     ]
    
async def delete_session(session_id: str):
    session = await SessionLog.find_one(SessionLog.session_id == session_id)
    session.visible = False
    session.updated_at = datetime.now(timezone.utc)
    await session.save()

    return {"status": "success", "message": f"Session '{session_id}' deleted"}


async def create_or_update_onboarding(user_id: str, data: dict) -> Onboarding:
    try:
        onboarding = await Onboarding.find_one(Onboarding.user_id == PydanticObjectId(user_id))
        if onboarding:
            for key, value in data.items():
                setattr(onboarding, key, value)
            await onboarding.save()
        else:
            onboarding = Onboarding(user_id=PydanticObjectId(user_id), **data)
            await onboarding.insert()
        return onboarding
    except Exception as e:
        print(f"Error in create_or_update_onboarding: {e}")
        raise

async def check_time_taken(session_id: Optional[str] = None, message_id: Optional[str]= None):
    query = {}
    if session_id:
        query["session_id"] = session_id
    if message_id:
        query["message_id"] = message_id
    return await MessageLog.find(query).to_list()



async def generate_title(history:List[dict]) -> str:
    # print("Generating title for session history...",history)
    content = ""
    for idx, entry in enumerate(history, start=1):
        for message_id, message_pair in entry.items():
            user_query, assistant_response = message_pair
            content += f"{idx}. User Query: {user_query}\n- Response: {assistant_response}\n\n---\n"

    try:
        title = await generate_session_title(content)
        return title.strip()
    except Exception as e:
        print(f"Title generation error: {e}")
        return "New Chat"

async def get_last_msg_in_session(session_id: str):
    return await MessageLog.find(
        {"session_id": session_id},
        sort=[("created_at", -1)]
        ).first_or_none()

async def store_user_query(user_id: str, session_id: str, message_id: str, user_query: str, timezone: str, doc_ids: List[str]=None):
    local_time = datetime.now(ZoneInfo(timezone))

    log_entry = await MessageLog.find_one({
        "session_id": str(session_id),
        "message_id": str(message_id)
    })
    print("************************************")
    print("log_entry", log_entry)
    human_input_data = {
        "user_query": user_query,
        "file_id" : doc_ids or [],
    }

    if not log_entry:
        log_entry = MessageLog(
            session_id=str(session_id),
            message_id=str(message_id),
            user_id=user_id,
            created_at=local_time,
            human_input=human_input_data
        )
        await log_entry.insert()
        print("%%%%%%%%%%%%%%%%%%%%")
        print("log_entry_created", log_entry)
    else:
        log_entry.human_input = human_input_data
        log_entry.created_at = local_time  # optional update
        await log_entry.save()
    



class VersionData(BaseModel):
    """Individual version data within a document"""
    version_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    version_number: int
    query: str
    final_content: str
    original_content: Optional[str] = None
    is_current: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processing_time_ms: Optional[int] = None

class CanvasResponse(Document):
    """Main document containing all versions of a canvas response"""
    document_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    session_id: str
    current_version: int = 1
    total_versions: int = 1
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # All versions stored in this single document
    versions: List[VersionData] = []
    
    class Settings:
        name = "canvas_response"  # Collection name
        
    def get_current_version_data(self) -> Optional[VersionData]:
        """Get the current version data"""
        for version in self.versions:
            if version.is_current:
                return version
        return None
    
    def get_version_by_number(self, version_number: int) -> Optional[VersionData]:
        """Get version by number"""
        for version in self.versions:
            if version.version_number == version_number:
                return version
        return None
    
    def add_new_version(self, query: str, final_content: str, original_content: str, processing_time_ms: int = None) -> int:
        """Add a new version and make it current"""
        # Mark all versions as not current
        for version in self.versions:
            version.is_current = False
        
        # Create new version
        new_version_number = self.total_versions + 1
        new_version = VersionData(
            version_number=new_version_number,
            query=query,
            final_content=final_content,
            original_content=original_content,
            is_current=True,
            processing_time_ms=processing_time_ms
        )
        
        # Add to versions list
        self.versions.append(new_version)
        
        # Update document metadata
        self.current_version = new_version_number
        self.total_versions = new_version_number
        self.updated_at = datetime.utcnow()
        
        return new_version_number
    
    def make_version_current(self, version_number: int) -> bool:
        """Make a specific version current and delete all versions after it"""
        # Find the version
        target_version = None
        for version in self.versions:
            if version.version_number == version_number:
                target_version = version
                break
        
        if not target_version:
            return False
        
        # Remove all versions with version_number > target version_number
        self.versions = [v for v in self.versions if v.version_number <= version_number]
        
        # Mark all remaining versions as not current
        for version in self.versions:
            version.is_current = False
        
        # Mark target version as current
        target_version.is_current = True
        
        # Update document metadata
        self.current_version = version_number
        self.total_versions = version_number  # Update total count after deletion
        self.updated_at = datetime.utcnow()
        
        return True

# ===== PYDANTIC MODELS FOR API =====

class CanvasRequest(BaseModel):
    query: str
    document_content: str
    session_id: str
    user_id: Optional[str] = None
    document_id: Optional[str] = None
    message_id: str 

class VersionActionRequest(BaseModel):
    """Schema for version management actions"""
    query: str
    document_content: str
    document_id: str
    version_number: int
    action: str = "make_latest"
    session_id: str
    user_id: Optional[str] = None
    message_id: str

class DocumentResponse(BaseModel):
    """Schema for API responses"""
    document_id: str
    version_number: int
    query: str
    final_content: str
    is_current: bool
    can_edit: bool
    created_at: datetime
    message: str

class VersionInfo(BaseModel):
    """Schema for version info in responses"""
    version_number: int
    query: str
    final_content: str
    created_at: datetime
    is_current: bool
    can_edit: bool
    processing_time_ms: Optional[int] = None

class DocumentHistory(BaseModel):
    """Schema for document history response"""
    document_id: str
    current_version_number: int
    total_versions: int
    versions: List[VersionInfo]

class DocumentListItem(BaseModel):
    """Schema for document list items"""
    document_id: str
    current_version: int
    total_versions: int
    created_at: datetime
    updated_at: datetime
    user_id: Optional[str]
    session_id: str
    current_query: str
    content_preview: str

# ===== UTILITY FUNCTIONS =====

def read_markdown_file(file_path: str) -> str:
    """Read and convert markdown file to HTML if needed, or return as text"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return content

def process_markdown_content(content: str) -> str:
    """Process markdown content - can convert to HTML or keep as markdown"""
    # For now, we'll keep it as markdown
    # If you want HTML conversion: return markdown.markdown(content)
    return content

# ===== CANVAS RESPONSE MANAGER =====

class CanvasResponseManager:
    """Manager for canvas response operations"""
    
    @staticmethod
    async def create_first_version(content: str, query: str, session_id: str, user_id: str = None) -> CanvasResponse:
        """Create a new canvas response with first version"""
        # Process content with AI
        start_time = time.time()
        processed_content = full_pipeline_api(content, query)
        processing_time = int((time.time() - start_time) * 1000)
        
        # Create first version
        first_version = VersionData(
            version_number=1,
            query=query,
            final_content=processed_content,
            original_content=content,
            is_current=True,
            processing_time_ms=processing_time
        )
        
        # Create canvas response document
        canvas_response = CanvasResponse(
            user_id=user_id,
            session_id=session_id,
            current_version=1,
            total_versions=1,
            versions=[first_version]
        )
        
        # Save to MongoDB
        await canvas_response.insert()
        return canvas_response
    
    @staticmethod
    async def add_new_version(document_id: str, content: str, query: str, session_id: str, user_id: str = None) -> CanvasResponse:
        """Add a new version to existing canvas response"""
        # Find the document
        canvas_response = await CanvasResponse.find_one(CanvasResponse.document_id == document_id)
        if not canvas_response:
            raise ValueError("Document not found")
        
        # Check if current version is the latest (can edit)
        current_version_data = canvas_response.get_current_version_data()
        if not current_version_data or current_version_data.version_number != canvas_response.total_versions:
            raise ValueError("Cannot edit from a previous version. Please make this version current first.")
        
        # Process content with AI
        start_time = time.time()
        processed_content = full_pipeline_api(content, query)
        processing_time = int((time.time() - start_time) * 1000)
        
        # Add new version to the document
        new_version_number = canvas_response.add_new_version(
            query=query,
            final_content=processed_content,
            original_content=content,
            processing_time_ms=processing_time
        )
        
        # Save updated document
        await canvas_response.save()
        return canvas_response
    
    @staticmethod
    async def get_canvas_response(document_id: str) -> CanvasResponse:
        """Get canvas response by document ID"""
        canvas_response = await CanvasResponse.find_one(CanvasResponse.document_id == document_id)
        if not canvas_response:
            raise ValueError("Document not found")
        return canvas_response
    
    @staticmethod
    async def make_version_current(document_id: str, version_number: int) -> tuple[CanvasResponse, int]:
        """Make a specific version current and delete all subsequent versions"""
        canvas_response = await CanvasResponse.find_one(CanvasResponse.document_id == document_id)
        if not canvas_response:
            raise ValueError("Document not found")
        
        # Check if version exists
        target_version = canvas_response.get_version_by_number(version_number)
        if not target_version:
            raise ValueError(f"Version {version_number} not found")
        
        # Count how many versions will be deleted
        versions_to_delete = [v for v in canvas_response.versions if v.version_number > version_number]
        deleted_count = len(versions_to_delete)
        
        # Make version current (this also deletes future versions)
        success = canvas_response.make_version_current(version_number)
        if not success:
            raise ValueError(f"Failed to make version {version_number} current")
        
        await canvas_response.save()
        return canvas_response, deleted_count
    
    @staticmethod
    async def list_canvas_responses(session_id: str = None, user_id: str = None) -> List[CanvasResponse]:
        """List canvas responses with optional filtering"""
        query = {}
        if session_id:
            query[CanvasResponse.session_id] = session_id
        if user_id:
            query[CanvasResponse.user_id] = user_id
        
        if query:
            return await CanvasResponse.find(query).sort(-CanvasResponse.created_at).to_list()
        else:
            return await CanvasResponse.find_all().sort(-CanvasResponse.created_at).to_list()
    
    @staticmethod
    async def delete_canvas_response(document_id: str) -> bool:
        """Delete a canvas response"""
        canvas_response = await CanvasResponse.find_one(CanvasResponse.document_id == document_id)
        if not canvas_response:
            raise ValueError("Document not found")
        
        await canvas_response.delete()
        return True
    
    @staticmethod
    async def search_canvas_responses(search_query: str, session_id: str = None, user_id: str = None, limit: int = 10) -> List[CanvasResponse]:
        """Search canvas responses by content or query"""
        # Build base query
        filters = []
        if session_id:
            filters.append(CanvasResponse.session_id == session_id)
        if user_id:
            filters.append(CanvasResponse.user_id == user_id)
        
        # Search in versions content and queries
        # Note: For text search, you might want to create text indexes in MongoDB
        if filters:
            query = CanvasResponse.find(*filters)
        else:
            query = CanvasResponse.find_all()
        
        results = await query.limit(limit).to_list()
        
        # Filter results based on search query (simple text matching)
        filtered_results = []
        for doc in results:
            for version in doc.versions:
                if (search_query.lower() in version.final_content.lower() or 
                    search_query.lower() in version.query.lower()):
                    filtered_results.append(doc)
                    break
        
        return filtered_results[:limit]
    
CONNECTION_STRING = os.getenv("AZURE_CONNECTION_STRING")
CONTAINER_NAME = os.getenv("AZURE_CONTAINER_NAME")
    
def get_blob_service_client():
    return BlobServiceClient.from_connection_string(CONNECTION_STRING)
    
async def upload_to_azure_blob(file_id: str, file: UploadFile) -> dict:

    blob_service_client = get_blob_service_client()
    try:
        container_client = blob_service_client.get_container_client(CONTAINER_NAME)
        container_client.create_container()
    except Exception as e:
        if "ContainerAlreadyExists" not in str(e):
            raise e
        
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else ''
    unique_filename = f"{uuid.uuid4()}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{file_extension}"
    file_data = await file.read()

    blob_client = blob_service_client.get_blob_client(
        container=CONTAINER_NAME,
        blob=unique_filename
    )
    blob_client.upload_blob(
        file_data,
        overwrite=True,
        content_type=file.content_type
    )

    doc = UploadResponse(file_id=file_id, original_filename=file.filename, blob=blob_client.url)
    await doc.insert()
    return {
        "filename": unique_filename,
        # "doc_id": str(saved_doc.id),
        "doc_id": str(file_id),
        "original_filename": file.filename,
        "url": blob_client.url,
        "size": len(file_data)
    }


async def download_blob_stream(file_id: str):
    # Get document from MongoDB
    doc = await UploadResponse.find_one({"file_id": file_id})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")

    blob_url = doc.blob
    blob_name = blob_url.split("/")[-1]

    # Get blob client
    blob_service_client = get_blob_service_client()
    blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=blob_name)

    # Get the download stream (this is lazy)
    try:
        download_stream = blob_client.download_blob()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing blob: {str(e)}")

    # Wrap it in an async generator (IMPORTANT)
    async def file_chunk_generator():
        stream = download_stream.chunks()
        for chunk in stream:
            yield chunk

    return blob_name, file_chunk_generator()

async def update_or_create_message_log(session_id: str, message_id: str, human_input: dict, response: dict, canvas_document_id: str = None) -> str:
    """Helper function to update existing message log or create new one"""
    try:
        # Check if message log already exists
        existing_message_log = await MessageLog.find_one(
            MessageLog.message_id == message_id,
            MessageLog.session_id == session_id
        )
        
        if existing_message_log:
            # Update existing message log
            existing_message_log.human_input = human_input
            existing_message_log.response = response
            existing_message_log.canvas_document_id = canvas_document_id
            existing_message_log.error = None  # Clear any previous errors
            existing_message_log.created_at = datetime.now(timezone.utc)
            await existing_message_log.save()
            return "updated"
        else:
            # Create new message log
            message_log = MessageLog(
                session_id=session_id,
                message_id=message_id,
                human_input=human_input,
                response=response,
                canvas_document_id=canvas_document_id,
                created_at=datetime.now(timezone.utc)
            )
            await message_log.insert()
            return "created"
    except Exception as log_error:
        print(f"Failed to update or create message log: {str(log_error)}")
        return "failed"
