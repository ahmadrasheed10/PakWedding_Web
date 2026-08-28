from datetime import datetime
from app.repositories.base_repository import BaseRepository


class BookingRepository(BaseRepository):
    
    def __init__(self, database):
        super().__init__(database, "bookings")
    
    async def get_by_user_id(self, user_id: str, skip: int = 0, limit: int = 100):
        from bson import ObjectId
        try:
            user_obj_id = ObjectId(user_id)
            bookings = await self.find_many({"user_id": user_obj_id}, skip, limit)
            if bookings:
                return bookings
        except:
            pass
        
        return await self.find_many({"user_id": user_id}, skip, limit)
    
    async def get_by_vendor_id(self, vendor_id: str, skip: int = 0, limit: int = 100):
        from bson import ObjectId
        try:
            vendor_obj_id = ObjectId(vendor_id)
            bookings = await self.find_many({"vendor_id": vendor_obj_id}, skip, limit)
            if bookings:
                return bookings
        except:
            pass
        
        return await self.find_many({"vendor_id": vendor_id}, skip, limit)
    
    async def get_by_status(self, status: str, skip: int = 0, limit: int = 100):
        return await self.find_many({"status": status}, skip, limit)

    async def get_vendor_bookings_in_range(self, vendor_id: str, start_date: datetime, end_date: datetime):
        """Fetch all active (non-rejected, non-cancelled) bookings for a vendor in a date range."""
        from bson import ObjectId
        vendor_ids = [vendor_id]
        try:
            vendor_ids.append(ObjectId(vendor_id))
        except:
            pass

        query = {
            "vendor_id": {"$in": vendor_ids},
            "event_date": {"$gte": start_date, "$lte": end_date},
            "status": {"$in": ["pending", "approved", "confirmed", "completed"]}
        }
        return await self.find_many(query, skip=0, limit=1000)

    async def check_slot_booked(self, vendor_id: str, start_of_day: datetime, end_of_day: datetime, time_slot: str) -> bool:
        """Check if a specific time slot is already booked (approved or confirmed) for a vendor on a given day."""
        from bson import ObjectId
        vendor_ids = [vendor_id]
        try:
            vendor_ids.append(ObjectId(vendor_id))
        except:
            pass

        query = {
            "vendor_id": {"$in": vendor_ids},
            "event_date": {"$gte": start_of_day, "$lte": end_of_day},
            "time_slot": time_slot,
            "status": {"$in": ["approved", "confirmed"]}
        }
        existing = await self.collection.find_one(query)
        return existing is not None

