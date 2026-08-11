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

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    conversation_history: List[Dict[str, str]] = []
    collected_info: Dict[str, Any] = {}
    expected_field: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    type: str
    vendors: List[Dict[str, Any]] = []
    collected_info: Dict[str, Any] = {}
    expected_field: Optional[str] = None
    data: List[Dict[str, Any]] = []


async def get_chatbot_service(
    vendor_repo = Depends(get_vendor_repository),
    booking_repo = Depends(get_booking_repository),
    review_repo = Depends(get_review_repository),
    favorite_repo = Depends(get_favorite_repository)
):
    try:
        return ChatbotService(vendor_repo, booking_repo, review_repo, favorite_repo)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    
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
            expected_field=chat_data.expected_field
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