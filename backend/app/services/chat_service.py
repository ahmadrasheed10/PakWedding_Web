from typing import List
from bson import ObjectId
from app.models.chat import Conversation, Message
from app.repositories.chat_repository import ChatRepository
from app.repositories.user_repository import UserRepository
from app.repositories.vendor_repository import VendorRepository
from fastapi import HTTPException


from datetime import datetime, timezone


class ChatService:
    def __init__(self, chat_repository: ChatRepository, user_repository: UserRepository, vendor_repository: VendorRepository):
        self.chat_repository = chat_repository
        self.user_repository = user_repository
        self.vendor_repository = vendor_repository

    async def get_or_create_conversation(self, user_id: str, vendor_id: str) -> dict:
        """Start or retrieve an existing conversation between a user and a vendor."""
        # Validate vendor exists
        vendor = await self.vendor_repository.get_by_id(vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        conv = await self.chat_repository.get_conversation_by_participants(user_id, vendor_id)
        if conv:
            return self._serialize_conversation(conv)

        new_conv = Conversation(user_id=user_id, vendor_id=vendor_id)
        created = await self.chat_repository.create_conversation(new_conv)
        return self._serialize_conversation(created)

    async def get_user_conversations(self, user_id: str) -> List[dict]:
        conversations = await self.chat_repository.get_conversations_for_user(user_id)
        return await self._enrich_conversations(conversations, user_id)

    async def get_vendor_conversations(self, vendor_id: str, user_id: str) -> List[dict]:
        """Get conversations for a vendor, validating the requester owns that vendor profile."""
        vendor = await self.vendor_repository.get_by_id(vendor_id)
        if not vendor or str(vendor.get("user_id")) != str(user_id):
            raise HTTPException(status_code=403, detail="Not authorized to view these conversations")
        conversations = await self.chat_repository.get_conversations_for_vendor(vendor_id)
        return await self._enrich_conversations(conversations, vendor_id)

    async def get_conversations_for_vendor_no_auth_check(self, vendor_id: str, user_id: str) -> List[dict]:
        """Get conversations for a vendor (auth check already done in route via vendor profile lookup)."""
        conversations = await self.chat_repository.get_conversations_for_vendor(vendor_id)
        return await self._enrich_conversations(conversations, vendor_id)

    async def _enrich_conversations(self, conversations: List[Conversation], requesting_id: str) -> List[dict]:
        result = []
        for conv in conversations:
            conv_dict = self._serialize_conversation(conv)
            conv_dict["unread_count"] = await self.chat_repository.get_unread_count(str(conv.id), requesting_id)

            user = await self.user_repository.get_by_id(conv.user_id)
            if user:
                conv_dict["user_name"] = user.get("full_name") or user.get("email", "User")

            vendor = await self.vendor_repository.get_by_id(conv.vendor_id)
            if vendor:
                conv_dict["vendor_name"] = vendor.get("business_name") or vendor.get("contact_person", "Vendor")
                conv_dict["vendor_category"] = vendor.get("service_category", "")

            result.append(conv_dict)
        return result

    async def get_messages(self, conversation_id: str, requester_id: str) -> List[dict]:
        conv = await self.chat_repository.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        await self.chat_repository.mark_messages_read(conversation_id, requester_id)
        messages = await self.chat_repository.get_messages(conversation_id)
        return [self._serialize_message(m) for m in messages]

    async def send_message(self, conversation_id: str, sender_id: str, text: str, image_url: str = None) -> dict:
        conv = await self.chat_repository.get_conversation_by_id(conversation_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        new_msg = Message(
            conversation_id=conversation_id,
            sender_id=sender_id,
            text=text,
            image_url=image_url
        )
        saved = await self.chat_repository.add_message(new_msg)
        return self._serialize_message(saved)

    def _serialize_conversation(self, conv: Conversation) -> dict:
        return {
            "_id": str(conv.id),
            "user_id": conv.user_id,
            "vendor_id": conv.vendor_id,
            "last_message": conv.last_message,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "user_name": conv.user_name,
            "vendor_name": conv.vendor_name,
            "unread_count": conv.unread_count,
        }

    def _serialize_message(self, msg: Message) -> dict:
        return {
            "_id": str(msg.id),
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            "text": msg.text,
            "image_url": msg.image_url,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
            "is_read": msg.is_read,
        }



async def update_typing_status(
    self,
    conversation_id: str,
    user_id: str,
    is_typing: bool
):
    await self.chat_repository.update_typing_status(
        conversation_id,
        user_id,
        is_typing
    )
