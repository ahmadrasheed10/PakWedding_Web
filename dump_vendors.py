import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.PakWeddingDB
    cursor = db.vendors.find({'is_approved': True, 'is_active': True})
    vendors = await cursor.to_list(length=100)
    for v in vendors:
        print(v.get('business_name'), '|', v.get('business_address'))

asyncio.run(main())
