from typing import Generic, TypeVar, Optional, List
from abc import ABC, abstractmethod
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

T = TypeVar('T')


class IRepository(ABC, Generic[T]):
    
    @abstractmethod
    async def create(self, entity: T) -> T:
        pass
    
    @abstractmethod
    async def get_by_id(self, entity_id: str) -> Optional[T]:
        pass
    
    @abstractmethod
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        pass
    
    @abstractmethod
    async def update(self, entity_id: str, entity: T) -> Optional[T]:
        pass
    
    @abstractmethod
    async def delete(self, entity_id: str) -> bool:
        pass


class BaseRepository(IRepository[T]):
    
    def __init__(self, database: AsyncIOMotorDatabase, collection_name: str):
        self.db = database
        self.collection = database[collection_name]
    
    async def create(self, entity: dict) -> dict:
        result = await self.collection.insert_one(entity)
        entity["_id"] = str(result.inserted_id)
        return entity
    
    async def get_by_id(self, entity_id: str) -> Optional[dict]:
        try:
            obj_id = ObjectId(entity_id)
            entity = await self.collection.find_one({"_id": obj_id})
        except Exception:
            return None
        
        if entity:
            entity["_id"] = str(entity["_id"])
        return entity
    
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[dict]:
        cursor = self.collection.find().skip(skip).limit(limit)
        entities = await cursor.to_list(length=limit)
        for entity in entities:
            entity["_id"] = str(entity["_id"])
        return entities
    
    async def update(self, entity_id: str, entity: dict) -> Optional[dict]:
        result = await self.collection.update_one(
            {"_id": ObjectId(entity_id)},
            {"$set": entity}
        )
        if result.matched_count:
            return await self.get_by_id(entity_id)
        return None
    
    async def delete(self, entity_id: str) -> bool:
        result = await self.collection.delete_one({"_id": ObjectId(entity_id)})
        return result.deleted_count > 0
    
    async def find_one(self, query: dict) -> Optional[dict]:
        entity = await self.collection.find_one(query)
        if entity:
            entity["_id"] = str(entity["_id"])
        return entity
    
    async def find_many(self, query: dict, skip: int = 0, limit: int = 100) -> List[dict]:
        cursor = self.collection.find(query).skip(skip).limit(limit)
        entities = await cursor.to_list(length=limit)
        for entity in entities:
            entity["_id"] = str(entity["_id"])
        return entities


