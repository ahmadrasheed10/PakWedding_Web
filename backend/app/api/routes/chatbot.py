from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.services.chatbot_service import ChatbotService
from app.api.dependencies import (
    get_vendor_repository,
    get_booking_repository,
    get_review_repository,
    get_favorite_repository,
    get_current_user
)
from app.core.database import get_db
from app.repositories.chat_session_repository import ChatSessionRepository

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    conversation_history: List[Dict[str, str]] = []
    collected_info: Dict[str, Any] = {}
    expected_field: Optional[str] = None
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    type: str
    vendors: List[Dict[str, Any]] = []
    collected_info: Dict[str, Any] = {}
    expected_field: Optional[str] = None
    data: List[Dict[str, Any]] = []
    session_id: Optional[str] = None


class CreateSessionRequest(BaseModel):
    title: str


class UpdateSessionRequest(BaseModel):
    title: Optional[str] = None


async def get_chatbot_service(
    vendor_repo = Depends(get_vendor_repository),
    booking_repo = Depends(get_booking_repository),
    review_repo = Depends(get_review_repository),
    favorite_repo = Depends(get_favorite_repository),
    db = Depends(get_db)
):
    try:
        chat_session_repo = ChatSessionRepository(db)
        return ChatbotService(vendor_repo, booking_repo, review_repo, favorite_repo, chat_session_repo)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


async def get_chat_session_repo(db = Depends(get_db)):
    return ChatSessionRepository(db)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    chat_data: ChatMessage,
    current_user: dict = Depends(get_current_user),
    chatbot_service: ChatbotService = Depends(get_chatbot_service)
):
    """Chat with the AI assistant"""
    try:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        
        result = await chatbot_service.chat(
            message=chat_data.message,
            conversation_history=chat_data.conversation_history,
            user_id=user_id,
            collected_info=chat_data.collected_info,
            expected_field=chat_data.expected_field,
            session_id=chat_data.session_id
        )
        
        return ChatResponse(**result)
    except Exception as e:
        print(f"error {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process chat message"
        )


@router.post("/sessions")
async def create_session(
    request: CreateSessionRequest,
    current_user: dict = Depends(get_current_user),
    session_repo: ChatSessionRepository = Depends(get_chat_session_repo)
):
    """Create a new chat session"""
    try:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        session_id = await session_repo.create(
            user_id=user_id,
            title=request.title,
            messages=[]
        )
        return {"session_id": session_id, "title": request.title}
    except Exception as e:
        print(f"error {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create session"
        )


@router.get("/sessions")
async def get_sessions(
    current_user: dict = Depends(get_current_user),
    session_repo: ChatSessionRepository = Depends(get_chat_session_repo)
):
    """Get all chat sessions for the current user"""
    try:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        sessions = await session_repo.get_by_user(user_id)
        return {"sessions": sessions}
    except Exception as e:
        print(f"error {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get sessions"
        )


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    session_repo: ChatSessionRepository = Depends(get_chat_session_repo)
):
    """Get a specific chat session"""
    try:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        session = await session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        if session.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        return session
    except HTTPException:
        raise
    except Exception as e:
        print(f"error {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get session"
        )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    session_repo: ChatSessionRepository = Depends(get_chat_session_repo)
):
    """Delete a chat session"""
    try:
        user_id = str(current_user.get("_id") or current_user.get("id"))
        session = await session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        if session.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        await session_repo.delete(session_id)
        return {"message": "Session deleted"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"error {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete session"
        )