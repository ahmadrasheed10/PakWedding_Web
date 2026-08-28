from typing import Optional, List
from datetime import datetime
from app.repositories.booking_repository import BookingRepository
from app.models.booking import BookingCreate, BookingUpdate, BookingStatus


class BookingService:
    
    def __init__(self, booking_repository: BookingRepository):
        self.booking_repo = booking_repository
    
    async def create_booking(self, booking_data: BookingCreate, stats_service: Optional['VendorStatsService'] = None) -> dict:
        booking_dict = booking_data.model_dump()
        booking_dict["status"] = BookingStatus.PENDING
        booking_dict["created_at"] = datetime.utcnow()
        booking_dict["updated_at"] = datetime.utcnow()
        
        from bson import ObjectId
        vendor_id_str = str(booking_dict.get("vendor_id", ""))
        
        # Normalize event_date
        event_date = booking_dict.get("event_date")
        if isinstance(event_date, str):
            event_date = datetime.fromisoformat(event_date.replace("Z", "+00:00"))
        
        # Ensure time slot (default to '1-4' if not specified)
        time_slot = booking_dict.get("time_slot") or "1-4"
        booking_dict["time_slot"] = time_slot

        # Validate against existing approved/confirmed bookings on this date & slot
        if event_date and vendor_id_str:
            start_of_day = datetime(event_date.year, event_date.month, event_date.day, 0, 0, 0)
            end_of_day = datetime(event_date.year, event_date.month, event_date.day, 23, 59, 59)
            
            is_booked = await self.booking_repo.check_slot_booked(
                vendor_id_str, start_of_day, end_of_day, time_slot
            )
            if is_booked:
                slot_label = "1:00 PM - 4:00 PM (Afternoon)" if time_slot == "1-4" else "7:00 PM - 10:00 PM (Evening)"
                date_label = event_date.strftime("%Y-%m-%d")
                raise ValueError(f"The time slot '{slot_label}' on {date_label} is already booked. Please select another slot or date.")

        if "vendor_id" in booking_dict and booking_dict["vendor_id"]:
            try:
                booking_dict["vendor_id"] = ObjectId(booking_dict["vendor_id"])
            except:
                pass
        if "user_id" in booking_dict and booking_dict["user_id"]:
            try:
                booking_dict["user_id"] = ObjectId(booking_dict["user_id"])
            except:
                pass
        
        booking = await self.booking_repo.create(booking_dict)
        
        if stats_service and vendor_id_str:
            await stats_service.increment_pending_requests(vendor_id_str)
            await stats_service.update_vendor_stats(vendor_id_str)
        
        return booking

    async def get_vendor_availability(self, vendor_id: str, year: int, month: int) -> dict:
        """Get booked time slots for a vendor in a given month."""
        import calendar
        _, last_day = calendar.monthrange(year, month)
        start_date = datetime(year, month, 1, 0, 0, 0)
        end_date = datetime(year, month, last_day, 23, 59, 59)

        bookings = await self.booking_repo.get_vendor_bookings_in_range(vendor_id, start_date, end_date)
        
        # Aggregate by date string "YYYY-MM-DD"
        booked_map = {}
        for b in bookings:
            ed = b.get("event_date")
            if not ed:
                continue
            if isinstance(ed, str):
                try:
                    ed = datetime.fromisoformat(ed.replace("Z", "+00:00"))
                except:
                    continue
            
            date_key = ed.strftime("%Y-%m-%d")
            slot = b.get("time_slot") or "1-4"
            b_status = b.get("status", "pending")
            
            if date_key not in booked_map:
                booked_map[date_key] = []
            
            # Avoid duplicate slot entries in map
            if not any(item["slot"] == slot for item in booked_map[date_key]):
                booked_map[date_key].append({
                    "slot": slot,
                    "status": b_status,
                    "booking_id": str(b.get("_id", ""))
                })

        return {
            "vendor_id": vendor_id,
            "year": year,
            "month": month,
            "booked_dates": booked_map
        }
    
    async def get_booking_by_id(self, booking_id: str) -> Optional[dict]:
        return await self.booking_repo.get_by_id(booking_id)
    
    async def get_user_bookings(self, user_id: str, skip: int = 0, limit: int = 100):
        return await self.booking_repo.get_by_user_id(user_id, skip, limit)
    
    async def get_vendor_bookings(self, vendor_id: str, skip: int = 0, limit: int = 100):
        return await self.booking_repo.get_by_vendor_id(vendor_id, skip, limit)
    
    async def update_booking(self, booking_id: str, booking_data: BookingUpdate) -> Optional[dict]:
        update_dict = booking_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.utcnow()
        return await self.booking_repo.update(booking_id, update_dict)
    
    async def cancel_booking(self, booking_id: str) -> Optional[dict]:
        return await self.booking_repo.update(booking_id, {
            "status": BookingStatus.CANCELLED,
            "updated_at": datetime.utcnow()
        })
    
    async def confirm_booking(self, booking_id: str) -> Optional[dict]:
        return await self.booking_repo.update(booking_id, {
            "status": BookingStatus.CONFIRMED,
            "updated_at": datetime.utcnow()
        })
    
    async def approve_booking(self, booking_id: str, stats_service: Optional['VendorStatsService'] = None) -> Optional[dict]:
        booking = await self.booking_repo.get_by_id(booking_id)
        old_status = booking.get("status") if booking else None
        
        result = await self.booking_repo.update(booking_id, {
            "status": BookingStatus.APPROVED,
            "updated_at": datetime.utcnow()
        })
        
        if stats_service and booking:
            vendor_id = str(booking.get("vendor_id", ""))
            if old_status == "pending":
                await stats_service.decrement_pending_requests(vendor_id)
            await stats_service.add_revenue(vendor_id, booking.get("total_amount", 0))
            await stats_service.update_vendor_stats(vendor_id)
        
        return result
    
    async def reject_booking(self, booking_id: str, stats_service: Optional['VendorStatsService'] = None) -> Optional[dict]:
        booking = await self.booking_repo.get_by_id(booking_id)
        old_status = booking.get("status") if booking else None
        
        result = await self.booking_repo.update(booking_id, {
            "status": BookingStatus.REJECTED,
            "updated_at": datetime.utcnow()
        })
        
        if stats_service and booking and old_status == "pending":
            vendor_id = str(booking.get("vendor_id", ""))
            await stats_service.decrement_pending_requests(vendor_id)
            await stats_service.update_vendor_stats(vendor_id)
        
        return result

