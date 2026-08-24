from motor.motor_asyncio import AsyncIOMotorClient
from app.models.chat import Conversation, Message
from bson import ObjectId
from typing import List, Optional
import os


class ChatRepository:
    def __init__(self, db_client):
        self.db = db_client
        self.conversations = self.db["conversations"]
        self.messages = self.db["messages"]

    async def create_conversation(self, conversation: Conversation) -> Conversation:
        doc = {
            "user_id": conversation.user_id,
            "vendor_id": conversation.vendor_id,
            "last_message": conversation.last_message,
            "last_message_at": conversation.last_message_at,
            "created_at": conversation.created_at,
        }
        result = await self.conversations.insert_one(doc)
        conversation.id = result.inserted_id
        return conversation

    async def get_conversation_by_participants(self, user_id: str, vendor_id: str) -> Optional[Conversation]:
        data = await self.conversations.find_one({"user_id": user_id, "vendor_id": vendor_id})
        if data:
            return Conversation(**{**data, "_id": data["_id"]})
        return None

    async def get_conversation_by_id(self, conversation_id: str) -> Optional[Conversation]:
        if not ObjectId.is_valid(conversation_id):
            return None
        data = await self.conversations.find_one({"_id": ObjectId(conversation_id)})
        if data:
            return Conversation(**{**data, "_id": data["_id"]})
        return None

    async def get_conversations_for_user(self, user_id: str) -> List[Conversation]:
        cursor = self.conversations.find({"user_id": user_id}).sort("last_message_at", -1)
        return [Conversation(**{**doc, "_id": doc["_id"]}) async for doc in cursor]

    async def get_conversations_for_vendor(self, vendor_id: str) -> List[Conversation]:
        cursor = self.conversations.find({"vendor_id": vendor_id}).sort("last_message_at", -1)
        return [Conversation(**{**doc, "_id": doc["_id"]}) async for doc in cursor]

    async def add_message(self, message: Message) -> Message:
        doc = {
            "conversation_id": message.conversation_id,
            "sender_id": message.sender_id,
            "text": message.text,
            "image_url": message.image_url,
            "created_at": message.created_at,
            "is_read": message.is_read,
        }
        result = await self.messages.insert_one(doc)
        message.id = result.inserted_id

        await self.conversations.update_one(
            {"_id": ObjectId(message.conversation_id)},
            {
                "$set": {
                    "last_message": message.text,
                    "last_message_at": message.created_at
                }
            }
        )
        return message

    async def get_messages(self, conversation_id: str) -> List[Message]:
        cursor = self.messages.find({"conversation_id": conversation_id}).sort("created_at", 1)
        return [Message(**{**doc, "_id": doc["_id"]}) async for doc in cursor]

    async def mark_messages_read(self, conversation_id: str, reader_id: str):
        """Mark all messages NOT sent by reader_id as read."""
        await self.messages.update_many(
            {"conversation_id": conversation_id, "sender_id": {"$ne": reader_id}},
            {"$set": {"is_read": True}}
        )

    async def get_unread_count(self, conversation_id: str, user_id: str) -> int:
        return await self.messages.count_documents(
            {"conversation_id": conversation_id, "sender_id": {"$ne": user_id}, "is_read": False}
        )


async def update_typing_status(
    self,
    conversation_id: str,
    user_id: str,
    is_typing: bool
):
    collection = self.db["conversations"]

    if is_typing:
        await collection.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$set": {
                    f"typing.{user_id}": datetime.now(timezone.utc)
                }
            }
        )
    else:
        await collection.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$unset": {
                    f"typing.{user_id}": ""
                }
            }
        )
