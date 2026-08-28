from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from app.services.booking_service import BookingService
from app.services.vendor_service import VendorService
from app.api.dependencies import get_booking_service, get_current_vendor, get_vendor_service, get_vendor_stats_service
from app.models.booking import BookingResponse

router = APIRouter()


@router.get("/bookings", response_model=List[BookingResponse])
async def get_vendor_bookings(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_vendor),
    booking_service: BookingService = Depends(get_booking_service),
    vendor_service: VendorService = Depends(get_vendor_service)
):
    try:
        from bson import ObjectId
        
        user_id = current_user.get("_id") or current_user.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="User ID not found in authentication token"
            )
        
        vendor = await vendor_service.vendor_repo.get_by_user_id(str(user_id))
        
        if not vendor:
            try:
                obj_id = ObjectId(user_id)
                vendor = await vendor_service.vendor_repo.find_one({"user_id": obj_id})
            except Exception as e:
                print(f"Error converting user_id to ObjectId: {e}")
        
        if not vendor:
            vendor = await vendor_service.vendor_repo.find_one({"user_id": str(user_id)})
        
        if not vendor:
            print(f"Vendor lookup failed for user_id: {user_id} (type: {type(user_id)})")
            print(f"Current user: {current_user}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Vendor profile not found. Please ensure you have registered as a vendor."
            )
        
        vendor_id = str(vendor["_id"])
        
        if status_filter:
            bookings = await booking_service.get_vendor_bookings(vendor_id, skip, limit)
            bookings = [b for b in bookings if b.get("status") == status_filter]
        else:
            bookings = await booking_service.get_vendor_bookings(vendor_id, skip, limit)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in get_vendor_bookings: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve bookings: {str(e)}"
        )
    
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
                from datetime import datetime
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


@router.post("/bookings/{booking_id}/approve", response_model=BookingResponse)
async def approve_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_vendor),
    booking_service: BookingService = Depends(get_booking_service),
    vendor_service: VendorService = Depends(get_vendor_service),
    stats_service = Depends(get_vendor_stats_service)
):
    try:
        booking = await booking_service.get_booking_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        
        from bson import ObjectId
        user_id = current_user.get("_id") or current_user.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User ID not found in authentication token"
            )
        
        vendor = await vendor_service.vendor_repo.get_by_user_id(str(user_id))
        
        if not vendor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
        
        vendor_id = str(vendor["_id"])
        booking_vendor_id = str(booking.get("vendor_id"))
        
        if booking_vendor_id != vendor_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only approve your own bookings")
        
        approved_booking = await booking_service.approve_booking(booking_id, stats_service)
        if not approved_booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        
        if "_id" in approved_booking:
            approved_booking["id"] = str(approved_booking["_id"])
            del approved_booking["_id"]
        
        if "user_id" in approved_booking:
            approved_booking["user_id"] = str(approved_booking["user_id"])
        if "vendor_id" in approved_booking:
            approved_booking["vendor_id"] = str(approved_booking["vendor_id"])
        if "service_id" in approved_booking and approved_booking["service_id"]:
            approved_booking["service_id"] = str(approved_booking["service_id"])
        
        from datetime import datetime
        if "created_at" in approved_booking:
            if isinstance(approved_booking["created_at"], str):
                try:
                    approved_booking["created_at"] = datetime.fromisoformat(approved_booking["created_at"].replace('Z', '+00:00'))
                except:
                    approved_booking["created_at"] = datetime.utcnow()
            elif not isinstance(approved_booking["created_at"], datetime):
                approved_booking["created_at"] = datetime.utcnow()
        
        if "event_date" in approved_booking:
            if isinstance(approved_booking["event_date"], str):
                try:
                    approved_booking["event_date"] = datetime.fromisoformat(approved_booking["event_date"].replace('Z', '+00:00'))
                except:
                    pass
        
        allowed_fields = {
            "id", "user_id", "vendor_id", "service_id", "event_date", 
            "event_location", "guest_count", "special_requirements", 
            "total_amount", "status", "created_at"
        }
        approved_booking = {k: v for k, v in approved_booking.items() if k in allowed_fields}
        
        return approved_booking
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[ERROR] Error approving booking {booking_id}: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve booking: {str(e)}"
        )


@router.post("/bookings/{booking_id}/reject", response_model=BookingResponse)
async def reject_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_vendor),
    booking_service: BookingService = Depends(get_booking_service),
    vendor_service: VendorService = Depends(get_vendor_service),
    stats_service = Depends(get_vendor_stats_service)
):
    try:
        booking = await booking_service.get_booking_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        
        from bson import ObjectId
        user_id = current_user.get("_id") or current_user.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User ID not found in authentication token"
            )
        
        vendor = await vendor_service.vendor_repo.get_by_user_id(str(user_id))
        
        if not vendor:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
        
        vendor_id = str(vendor["_id"])
        booking_vendor_id = str(booking.get("vendor_id"))
        
        if booking_vendor_id != vendor_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only reject your own bookings")
        
        rejected_booking = await booking_service.reject_booking(booking_id, stats_service)
        if not rejected_booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
        
        if "_id" in rejected_booking:
            rejected_booking["id"] = str(rejected_booking["_id"])
            del rejected_booking["_id"]
        
        if "user_id" in rejected_booking:
            rejected_booking["user_id"] = str(rejected_booking["user_id"])
        if "vendor_id" in rejected_booking:
            rejected_booking["vendor_id"] = str(rejected_booking["vendor_id"])
        if "service_id" in rejected_booking and rejected_booking["service_id"]:
            rejected_booking["service_id"] = str(rejected_booking["service_id"])
        
        from datetime import datetime
        if "created_at" in rejected_booking:
            if isinstance(rejected_booking["created_at"], str):
                try:
                    rejected_booking["created_at"] = datetime.fromisoformat(rejected_booking["created_at"].replace('Z', '+00:00'))
                except:
                    rejected_booking["created_at"] = datetime.utcnow()
            elif not isinstance(rejected_booking["created_at"], datetime):
                rejected_booking["created_at"] = datetime.utcnow()
        
        if "event_date" in rejected_booking:
            if isinstance(rejected_booking["event_date"], str):
                try:
                    rejected_booking["event_date"] = datetime.fromisoformat(rejected_booking["event_date"].replace('Z', '+00:00'))
                except:
                    pass
        
        allowed_fields = {
            "id", "user_id", "vendor_id", "service_id", "event_date", 
            "event_location", "guest_count", "special_requirements", 
            "total_amount", "status", "created_at"
        }
        rejected_booking = {k: v for k, v in rejected_booking.items() if k in allowed_fields}
        
        return rejected_booking
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[ERROR] Error rejecting booking {booking_id}: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject booking: {str(e)}"
        )

