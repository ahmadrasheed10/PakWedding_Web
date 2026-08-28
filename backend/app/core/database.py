from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class Database:
    
    client: AsyncIOMotorClient = None
    
    @classmethod
    def get_client(cls) -> AsyncIOMotorClient:
        if cls.client is None:
            cls.client = AsyncIOMotorClient(
                settings.DATABASE_URL,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000
            )
        return cls.client
    
    @classmethod
    async def connect_db(cls):
        client = cls.get_client()
        try:
            await client.admin.command('ping')
            print("Connected to MongoDB successfully")
        except Exception as e:
            print(f"MongoDB connection error: {e}")
            raise
    
    @classmethod
    async def close_db(cls):
        if cls.client:
            cls.client.close()
            cls.client = None
            print("MongoDB connection closed")
    
    @classmethod
    def get_database(cls):
        return cls.get_client()[settings.DATABASE_NAME]


async def get_db():
    return Database.get_database()


