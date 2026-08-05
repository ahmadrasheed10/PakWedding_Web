from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from typing import List, Optional
from app.services.vendor_service import VendorService
from app.api.dependencies import get_vendor_service, get_current_vendor, get_optional_current_user
from app.models.vendor import VendorCreate, VendorUpdate, VendorResponse

router = APIRouter()


@router.post("/register", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def register_vendor(
    vendor_data: VendorCreate,
    vendor_service: VendorService = Depends(get_vendor_service),
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    try:
        vendor = await vendor_service.register_vendor(vendor_data, clerk_user=current_user)
        return vendor
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Error registering vendor: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register vendor: {str(e)}"
        )


@router.get("/", response_model=List[VendorResponse])
async def get_vendors(
    category: str = Query(None),
    skip: int = 0,
    limit: int = Query(200, ge=1, le=1000),
    vendor_service: VendorService = Depends(get_vendor_service)
):
    try:
        if category:
            vendors = await vendor_service.get_vendors_by_category(category, skip, limit)
        else:
            query = {"is_approved": True, "is_active": True}
            print(f"[DEBUG] Fetching vendors with query: {query}")
            vendors = await vendor_service.vendor_repo.find_many(query, skip, limit)
            print(f"[DEBUG] Found {len(vendors)} approved vendors")
            
            if vendors and len(vendors) > 0:
                first_vendor = vendors[0]
                print(f"[DEBUG] First vendor: {first_vendor.get('business_name')}, is_approved: {first_vendor.get('is_approved')}, is_active: {first_vendor.get('is_active')}")
        
        formatted_vendors = []
        for vendor in vendors:
            formatted_vendor = vendor.copy()
            
            if "_id" in formatted_vendor:
                formatted_vendor["id"] = str(formatted_vendor["_id"])
                del formatted_vendor["_id"]
            
            formatted_vendor.pop("user_id", None)
            formatted_vendor.pop("hashed_password", None)
            formatted_vendor.pop("updated_at", None)
            
            if "is_approved" not in formatted_vendor:
                formatted_vendor["is_approved"] = True
            if "is_active" not in formatted_vendor:
                formatted_vendor["is_active"] = True
            
            if "packages" not in formatted_vendor or formatted_vendor["packages"] is None:
                formatted_vendor["packages"] = []
            elif not isinstance(formatted_vendor["packages"], list):
                formatted_vendor["packages"] = []
            
            if "gallery_images" not in formatted_vendor or formatted_vendor["gallery_images"] is None:
                formatted_vendor["gallery_images"] = []
            elif not isinstance(formatted_vendor["gallery_images"], list):
                formatted_vendor["gallery_images"] = []
            
            formatted_vendors.append(formatted_vendor)
        
        print(f"[DEBUG] Returning {len(formatted_vendors)} formatted vendors")
        return formatted_vendors
    except Exception as e:
        print(f"[ERROR] Error fetching vendors: {e}")
        import traceback
        traceback.print_exc()
        raise


@router.get("/me", response_model=VendorResponse)
async def get_vendor_profile(
    current_user: dict = Depends(get_current_vendor),
    vendor_service: VendorService = Depends(get_vendor_service)
):
    vendor = await vendor_service.vendor_repo.get_by_user_id(current_user["_id"])
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
    
    if "_id" in vendor:
        vendor["id"] = str(vendor["_id"])
        del vendor["_id"]
    
    vendor.pop("user_id", None)
    vendor.pop("hashed_password", None)
    vendor.pop("updated_at", None)
    
    if "packages" not in vendor or vendor["packages"] is None:
        vendor["packages"] = []
    
    if "gallery_images" not in vendor or vendor["gallery_images"] is None:
        vendor["gallery_images"] = []
    
    return vendor


@router.put("/me", response_model=VendorResponse)
async def update_vendor_profile(
    vendor_data: VendorUpdate,
    current_user: dict = Depends(get_current_vendor),
    vendor_service: VendorService = Depends(get_vendor_service)
):
    vendor = await vendor_service.vendor_repo.get_by_user_id(current_user["_id"])
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
    
    updated_vendor = await vendor_service.update_vendor(vendor["_id"], vendor_data)
    
    if "_id" in updated_vendor:
        updated_vendor["id"] = str(updated_vendor["_id"])
        del updated_vendor["_id"]
    
    updated_vendor.pop("user_id", None)
    updated_vendor.pop("hashed_password", None)
    updated_vendor.pop("updated_at", None)
    
    if "packages" not in updated_vendor or updated_vendor["packages"] is None:
        updated_vendor["packages"] = []
    
    if "gallery_images" not in updated_vendor or updated_vendor["gallery_images"] is None:
        updated_vendor["gallery_images"] = []
    
    return updated_vendor


@router.get("/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: str,
    vendor_service: VendorService = Depends(get_vendor_service)
):
    from bson import ObjectId
    from bson.errors import InvalidId
    
    try:
        ObjectId(vendor_id)
    except InvalidId:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Invalid vendor ID format: '{vendor_id}'. Vendor ID must be a valid MongoDB ObjectId."
        )
    
    vendor = await vendor_service.get_vendor_by_id(vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    
    if "_id" in vendor:
        vendor["id"] = str(vendor["_id"])
        del vendor["_id"]
    
    vendor.pop("user_id", None)
    vendor.pop("hashed_password", None)
    vendor.pop("updated_at", None)
    
    if "gallery_images" not in vendor or vendor["gallery_images"] is None:
        vendor["gallery_images"] = []
    
    if "packages" not in vendor or vendor["packages"] is None:
        vendor["packages"] = []
    
    return vendor


@router.patch("/me/image", response_model=VendorResponse)
async def update_vendor_image(
    image_url: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_vendor),
    vendor_service: VendorService = Depends(get_vendor_service)
):
    vendor = await vendor_service.vendor_repo.get_by_user_id(current_user["_id"])
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
    
    updated_vendor = await vendor_service.update_vendor(
        vendor["_id"], 
        VendorUpdate(image_url=image_url)
    )
    return updated_vendor


@router.patch("/me/gallery", response_model=VendorResponse)
async def add_to_vendor_gallery(
    image_url: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_vendor),
    vendor_service: VendorService = Depends(get_vendor_service)
):
    vendor = await vendor_service.vendor_repo.get_by_user_id(current_user["_id"])
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
    
    current_gallery = vendor.get("gallery_images", []) or []
    if image_url not in current_gallery:
        current_gallery.append(image_url)
    
    updated_vendor = await vendor_service.update_vendor(
        vendor["_id"], 
        VendorUpdate(gallery_images=current_gallery)
    )
    return updated_vendor

