from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from app.services.booking_service import BookingService
from app.api.dependencies import get_booking_service, get_current_user, get_vendor_stats_service
from app.models.booking import BookingCreate, BookingCreateRequest, BookingUpdate, BookingResponse

router = APIRouter()


@router.post("/", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreateRequest,
    current_user: dict = Depends(get_current_user),
    booking_service: BookingService = Depends(get_booking_service),
    stats_service = Depends(get_vendor_stats_service)
):
    booking_dict = booking_data.model_dump()
    booking_dict["user_id"] = str(current_user["_id"])
    
    if "vendor_id" in booking_dict:
        booking_dict["vendor_id"] = str(booking_dict["vendor_id"])
    
    from app.models.booking import BookingCreate
    booking_create = BookingCreate(**booking_dict)
    try:
        booking = await booking_service.create_booking(booking_create, stats_service)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    if "_id" in booking:
        booking["id"] = str(booking["_id"])
        del booking["_id"]
    
    if "user_id" in booking:
        booking["user_id"] = str(booking["user_id"])
    if "vendor_id" in booking:
        booking["vendor_id"] = str(booking["vendor_id"])
    if "service_id" in booking and booking["service_id"]:
        booking["service_id"] = str(booking["service_id"])
    
    return booking


@router.get("/vendor/{vendor_id}/availability")
async def get_vendor_availability(
    vendor_id: str,
    year: Optional[int] = None,
    month: Optional[int] = None,
    booking_service: BookingService = Depends(get_booking_service)
):
    from datetime import datetime
    now = datetime.utcnow()
    target_year = year or now.year
    target_month = month or now.month
    
    if target_month < 1 or target_month > 12:
        raise HTTPException(status_code=400, detail="Invalid month. Must be between 1 and 12.")
        
    return await booking_service.get_vendor_availability(vendor_id, target_year, target_month)


@router.get("/my-bookings", response_model=List[BookingResponse])
async def get_my_bookings(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
    booking_service: BookingService = Depends(get_booking_service)
):
    user_id = str(current_user.get("_id") or current_user.get("id"))
    bookings = await booking_service.get_user_bookings(user_id, skip, limit)
    
    formatted_bookings = []
    for booking in bookings:
        try:
            formatted_booking = booking.copy()
            
            if "_id" in formatted_booking:
                formatted_booking["id"] = str(formatted_booking["_id"])
                del formatted_booking["_id"]
            
            if "user_id" in formatted_booking:
                formatted_booking["user_id"] = str(formatted_booking["user_id"])
            if "vendor_id" in formatted_booking:
                formatted_booking["vendor_id"] = str(formatted_booking["vendor_id"])
            if "service_id" in formatted_booking and formatted_booking["service_id"]:
                formatted_booking["service_id"] = str(formatted_booking["service_id"])
            
            from datetime import datetime
            if "created_at" in formatted_booking:
                if isinstance(formatted_booking["created_at"], str):
                    try:
                        formatted_booking["created_at"] = datetime.fromisoformat(formatted_booking["created_at"].replace('Z', '+00:00'))
                    except:
                        formatted_booking["created_at"] = datetime.utcnow()
                elif not isinstance(formatted_booking["created_at"], datetime):
                    formatted_booking["created_at"] = datetime.utcnow()
            
            if "event_date" in formatted_booking:
                if isinstance(formatted_booking["event_date"], str):
                    try:
                        formatted_booking["event_date"] = datetime.fromisoformat(formatted_booking["event_date"].replace('Z', '+00:00'))
                    except:
                        pass
            
            if "status" not in formatted_booking:
                formatted_booking["status"] = "pending"
            if "created_at" not in formatted_booking:
                formatted_booking["created_at"] = datetime.utcnow()
            
            allowed_fields = {
                "id", "user_id", "vendor_id", "service_id", "package_name", "event_date", "time_slot",
                "event_location", "guest_count", "special_requirements", 
                "total_amount", "status", "created_at"
            }
            formatted_booking = {k: v for k, v in formatted_booking.items() if k in allowed_fields}
            
            formatted_bookings.append(formatted_booking)
        except Exception as e:
            import traceback
            print(f"Error formatting booking {booking.get('_id', 'unknown')}: {e}")
            print(traceback.format_exc())
            continue
    
    return formatted_bookings


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    booking_service: BookingService = Depends(get_booking_service)
):
    booking = await booking_service.get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


@router.put("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: str,
    booking_data: BookingUpdate,
    current_user: dict = Depends(get_current_user),
    booking_service: BookingService = Depends(get_booking_service)
):
    updated_booking = await booking_service.update_booking(booking_id, booking_data)
    if not updated_booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return updated_booking


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    booking_service: BookingService = Depends(get_booking_service)
):
    cancelled_booking = await booking_service.cancel_booking(booking_id)
    if not cancelled_booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return cancelled_booking

