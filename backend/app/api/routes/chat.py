from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from typing import List, Optional
from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.services.chat_service import ChatService
from app.repositories.chat_repository import ChatRepository
from app.repositories.user_repository import UserRepository
from app.repositories.vendor_repository import VendorRepository
from pydantic import BaseModel

router = APIRouter()

class TypingRequest(BaseModel):
    is_typing: bool


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, conversation_id: str, websocket: WebSocket):
        await websocket.accept()

        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = []

        self.active_connections[conversation_id].append(websocket)

    def disconnect(self, conversation_id: str, websocket: WebSocket):
        if conversation_id in self.active_connections:
            if websocket in self.active_connections[conversation_id]:
                self.active_connections[conversation_id].remove(websocket)

            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]

    async def broadcast(self, conversation_id: str, message: dict):
        connections = self.active_connections.get(conversation_id, [])

        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(conversation_id, connection)


manager = ConnectionManager()

def get_chat_service(db=Depends(get_db)):
    return ChatService(
        chat_repository=ChatRepository(db),
        user_repository=UserRepository(db),
        vendor_repository=VendorRepository(db)
    )

class StartChatRequest(BaseModel):
    vendor_id: str

class SendMessageRequest(BaseModel):
    text: str
    sender_id: str  # user's _id or vendor's _id depending on who is sending
    image_url: Optional[str] = None


@router.websocket("/ws/{conversation_id}")
async def chat_websocket(
    websocket: WebSocket,
    conversation_id: str
):
    await manager.connect(conversation_id, websocket)

    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)

    except Exception:
        manager.disconnect(conversation_id, websocket)

@router.post("/conversations")
async def start_conversation(
    req: StartChatRequest,
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Start or get an existing conversation between a user and a vendor"""
    user_id = str(current_user["_id"])
    return await chat_service.get_or_create_conversation(user_id, req.vendor_id)

@router.get("/conversations/user")
async def get_user_conversations(
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Get all conversations for the logged-in user"""
    user_id = str(current_user["_id"])
    return await chat_service.get_user_conversations(user_id)

@router.get("/conversations/vendor")
async def get_vendor_conversations_me(
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service),
    db=Depends(get_db)
):
    """Get all conversations for the logged-in vendor (auto-detects their vendor profile)"""
    user_id = str(current_user["_id"])
    vendor_repo = VendorRepository(db)
    vendor = await vendor_repo.get_by_user_id(user_id)
    if not vendor:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Vendor profile not found for this user")
    vendor_id = str(vendor.get("_id") or vendor.get("id"))
    return await chat_service.get_conversations_for_vendor_no_auth_check(vendor_id, user_id)

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    as_vendor: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Get messages for a conversation. Pass as_vendor=vendor_id if requesting as a vendor."""
    requester_id = as_vendor if as_vendor else str(current_user["_id"])
    return await chat_service.get_messages(conversation_id, requester_id)

@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    req: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Send a message in a conversation"""

    message = await chat_service.send_message(
        conversation_id,
        req.sender_id,
        req.text,
        req.image_url
    )

    # Send the newly created message to everyone
    # connected to this conversation
    await manager.broadcast(
        conversation_id,
        message
    )

    return message



@router.post("/conversations/{conversation_id}/typing")
async def update_typing_status(
    conversation_id: str,
    req: TypingRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = str(current_user["_id"])

    # Store typing status
    await chat_service.update_typing_status(
        conversation_id,
        user_id,
        req.is_typing
    )

    return {"success": True}

@router.get("/conversations/{conversation_id}/typing")
async def get_typing_status(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service)
):
    user_id = str(current_user["_id"])

    return await chat_service.get_typing_status(
        conversation_id,
        user_id
    )