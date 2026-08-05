from typing import Optional
from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository):
    
    def __init__(self, database):
        super().__init__(database, "users")
    
    async def get_by_email(self, email: str) -> Optional[dict]:
        return await self.find_one({"email": email})
    
    async def get_by_role(self, role: str, skip: int = 0, limit: int = 100):
        return await self.find_many({"role": role}, skip, limit)

    async def get_by_clerk_id(self, clerk_id: str) -> Optional[dict]:
        return await self.find_one({"clerk_id": clerk_id})

    async def find_by_field(self, field: str, value) -> Optional[dict]:
        """Find a single document matching field == value."""
        return await self.find_one({field: value})
