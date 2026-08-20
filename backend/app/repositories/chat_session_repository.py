from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


class ChatSessionRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.chat_sessions

    async def create(self, user_id: str, title: str, messages: List[dict]) -> str:
        """Create a new chat session."""
        doc = {
            "user_id": user_id,
            "title": title,
            "messages": messages,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = await self.collection.insert_one(doc)
        return str(result.inserted_id)

    async def get_by_id(self, session_id: str) -> Optional[dict]:
        """Get a chat session by ID."""
        try:
            doc = await self.collection.find_one({"_id": ObjectId(session_id)})
            if doc:
                doc["_id"] = str(doc["_id"])
            return doc
        except:
            return None

    async def get_by_user(self, user_id: str, limit: int = 20) -> List[dict]:
        """Get all chat sessions for a user, ordered by updated_at desc."""
        cursor = self.collection.find({"user_id": user_id}).sort("updated_at", -1).limit(limit)
        sessions = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            sessions.append(doc)
        return sessions

    async def update(self, session_id: str, messages: List[dict], title: Optional[str] = None) -> bool:
        """Update a chat session with new messages and optionally title."""
        try:
            update_data = {
                "messages": messages,
                "updated_at": datetime.utcnow()
            }
            if title:
                update_data["title"] = title
            
            result = await self.collection.update_one(
                {"_id": ObjectId(session_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except:
            return False

    async def delete(self, session_id: str) -> bool:
        """Delete a chat session."""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(session_id)})
            return result.deleted_count > 0
        except:
            return False


