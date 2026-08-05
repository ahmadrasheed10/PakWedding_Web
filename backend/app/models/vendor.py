from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, Field
from bson import ObjectId


class PackageInfo(BaseModel):
    name: str
    price: float
    description: Optional[str] = None
    features: Optional[List[str]] = []


class VendorBase(BaseModel):
    business_name: str
    contact_person: str
    email: str
    phone_number: str
    business_address: str
    service_category: str
    description: Optional[str] = None
    rating: float = 0.0
    total_bookings: int = 0
    pending_requests: int = 0
    total_revenue: float = 0.0
    image_url: Optional[str] = None
    gallery_images: Optional[List[str]] = []
    packages: Optional[List[Dict]] = []


class VendorCreate(VendorBase):
    password: Optional[str] = None


class VendorUpdate(BaseModel):
    business_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone_number: Optional[str] = None
    business_address: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    packages: Optional[List[Dict]] = None


class VendorInDB(VendorBase):
    id: str = Field(alias="_id")
    user_id: str
    is_approved: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True


class VendorResponse(VendorBase):
    id: str
    is_approved: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

