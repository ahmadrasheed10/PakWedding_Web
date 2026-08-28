
from typing import Optional, List
from datetime import datetime
from app.repositories.vendor_repository import VendorRepository
from app.repositories.user_repository import UserRepository
from app.models.vendor import VendorCreate, VendorUpdate
from app.core.security import hash_password
from app.core.password_validator import validate_password_strength
from app.core.exceptions import ValidationException


class VendorService:
    
    def __init__(self, vendor_repository: VendorRepository, user_repository: UserRepository):
        self.vendor_repo = vendor_repository
        self.user_repo = user_repository
    
    async def register_vendor(self, vendor_data: VendorCreate, clerk_user: Optional[dict] = None) -> dict:
        email_clean = (vendor_data.email or "").strip().lower()
        existing_user = await self.user_repo.get_by_email(email_clean)
        if not existing_user and vendor_data.email:
            existing_user = await self.user_repo.get_by_email(vendor_data.email.strip())

        hashed_pw = None
        if vendor_data.password:
            try:
                hashed_pw = hash_password(vendor_data.password)
            except Exception:
                pass

        user = None

        if clerk_user:
            user = clerk_user
            # If a user with the same email exists in MongoDB under a different record, link them
            if existing_user and str(existing_user.get("_id")) != str(clerk_user.get("_id")):
                clerk_id = clerk_user.get("clerk_id") or clerk_user.get("sub")
                updates = {
                    "role": "vendor",
                    "full_name": vendor_data.contact_person,
                    "phone_number": vendor_data.phone_number,
                    "updated_at": datetime.utcnow()
                }
                if clerk_id:
                    updates["clerk_id"] = clerk_id
                if hashed_pw and not existing_user.get("hashed_password"):
                    updates["hashed_password"] = hashed_pw
                await self.user_repo.update(str(existing_user["_id"]), updates)
                user = await self.user_repo.get_by_id(str(existing_user["_id"]))
            else:
                updates = {
                    "role": "vendor",
                    "full_name": vendor_data.contact_person,
                    "phone_number": vendor_data.phone_number,
                    "updated_at": datetime.utcnow(),
                }
                if hashed_pw and not user.get("hashed_password"):
                    updates["hashed_password"] = hashed_pw
                await self.user_repo.update(str(user["_id"]), updates)
                user = await self.user_repo.get_by_id(str(user["_id"]))
        elif existing_user:
            # User already exists (e.g. registered in Clerk and synced)
            user = existing_user
            updates = {
                "role": "vendor",
                "full_name": vendor_data.contact_person,
                "phone_number": vendor_data.phone_number,
                "updated_at": datetime.utcnow(),
            }
            if hashed_pw and not user.get("hashed_password"):
                updates["hashed_password"] = hashed_pw
            await self.user_repo.update(str(user["_id"]), updates)
            user = await self.user_repo.get_by_id(str(user["_id"]))
        else:
            if not vendor_data.password:
                hashed_pw = None
            else:
                strength, issues, is_valid = validate_password_strength(vendor_data.password)
                if not is_valid:
                    error_message = "Password is too weak. " + "; ".join(issues)
                    raise ValidationException(detail=error_message)
                hashed_pw = hash_password(vendor_data.password)

            user_dict = {
                "email": email_clean,
                "full_name": vendor_data.contact_person,
                "phone_number": vendor_data.phone_number,
                "role": "vendor",
                "hashed_password": hashed_pw,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            user = await self.user_repo.create(user_dict)

        existing_vendor = await self.vendor_repo.get_by_user_id(str(user["_id"]))
        if not existing_vendor:
            existing_vendor = await self.vendor_repo.find_one({"email": email_clean})

        if existing_vendor:
            # If vendor profile already exists for this account, update and return it
            update_data = {
                "business_name": vendor_data.business_name,
                "contact_person": vendor_data.contact_person,
                "phone_number": vendor_data.phone_number,
                "business_address": vendor_data.business_address,
                "service_category": vendor_data.service_category,
                "user_id": str(user["_id"]),
                "updated_at": datetime.utcnow()
            }
            updated_vendor = await self.vendor_repo.update(str(existing_vendor["_id"]), update_data)
            return updated_vendor or existing_vendor
        
        vendor_dict = vendor_data.model_dump(exclude={"password"})
        vendor_dict["email"] = email_clean
        vendor_dict["user_id"] = str(user["_id"])
        vendor_dict["is_approved"] = False  
        vendor_dict["is_active"] = True  
        vendor_dict["created_at"] = datetime.utcnow()
        vendor_dict["updated_at"] = datetime.utcnow()
        
        if "packages" not in vendor_dict or not vendor_dict["packages"]:
            
            category_prices = {
                "Photography": {"basic": 50000, "standard": 100000, "premium": 200000},
                "Caterer": {"basic": 80000, "standard": 150000, "premium": 300000},
                "Decorator": {"basic": 60000, "standard": 120000, "premium": 250000},
                "Venue": {"basic": 100000, "standard": 200000, "premium": 400000},
                "Makeup Artist": {"basic": 30000, "standard": 60000, "premium": 120000},
                "DJ": {"basic": 40000, "standard": 80000, "premium": 150000},
                "Florist": {"basic": 25000, "standard": 50000, "premium": 100000},
                "Mehndi": {"basic": 20000, "standard": 40000, "premium": 80000},
                "Videography": {"basic": 60000, "standard": 120000, "premium": 250000},
            }
            
            category = vendor_dict.get('service_category', 'Other')
            prices = category_prices.get(category, {"basic": 50000, "standard": 100000, "premium": 200000})
            
            vendor_dict["packages"] = [
                {
                    "name": "Basic",
                    "price": float(prices["basic"]),
                    "description": f"Basic {category} package - Perfect for intimate celebrations",
                    "features": [
                        "Standard service coverage",
                        "Basic setup and delivery",
                        "Digital documentation",
                        "Email support"
                    ]
                },
                {
                    "name": "Standard",
                    "price": float(prices["standard"]),
                    "description": f"Standard {category} package - Ideal for most weddings",
                    "features": [
                        "Enhanced service coverage",
                        "Extended hours",
                        "Premium delivery",
                        "Priority support",
                        "Additional team members"
                    ]
                },
                {
                    "name": "Premium",
                    "price": float(prices["premium"]),
                    "description": f"Premium {category} package - Luxury experience",
                    "features": [
                        "Full premium service",
                        "Complete coverage",
                        "Priority delivery",
                        "Dedicated support team",
                        "Exclusive features",
                        "Post-event follow-up"
                    ]
                }
            ]
        
        vendor = await self.vendor_repo.create(vendor_dict)
        
        
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
    
    async def get_vendor_by_id(self, vendor_id: str) -> Optional[dict]:
        
        return await self.vendor_repo.get_by_id(vendor_id)
    
    async def get_vendors_by_category(self, category: str, skip: int = 0, limit: int = 100):
       
        vendors = await self.vendor_repo.get_by_category(category, skip, limit)
        
        return [v for v in vendors if v.get("is_active", True)]
    
    async def update_vendor(self, vendor_id: str, vendor_data: VendorUpdate) -> Optional[dict]:
       
        update_dict = vendor_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.utcnow()
        return await self.vendor_repo.update(vendor_id, update_dict)
    
    async def approve_vendor(self, vendor_id: str) -> Optional[dict]:
        
        vendor = await self.vendor_repo.approve_vendor(vendor_id)
        if vendor:
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
    
    async def reject_vendor(self, vendor_id: str) -> Optional[dict]:
      
        vendor = await self.vendor_repo.reject_vendor(vendor_id)
        if vendor:
            
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
    
    async def get_pending_approvals(self, skip: int = 0, limit: int = 100):
        
        vendors = await self.vendor_repo.get_pending_approvals(skip, limit)
        
        formatted = []
        for vendor in vendors:
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
            formatted.append(vendor)
        return formatted
    
    async def get_all_vendors_with_status(self, status_filter: str = None, skip: int = 0, limit: int = 100):
        
        vendors = await self.vendor_repo.get_all_vendors_with_status(status_filter, skip, limit)
        
        formatted = []
        for vendor in vendors:
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
            formatted.append(vendor)
        return formatted
    
    async def create_vendor_as_admin(self, vendor_data: VendorCreate) -> dict:
       
        print(f"[VENDOR_SERVICE] Starting vendor creation for: {vendor_data.email}")
        
        
        existing_user = await self.user_repo.get_by_email(vendor_data.email)
        if existing_user:
            print(f"[VENDOR_SERVICE] ERROR: User with email {vendor_data.email} already exists")
            raise ValueError("User with this email already exists")
        
        
        strength, issues, is_valid = validate_password_strength(vendor_data.password)
        if not is_valid:
            error_message = "Password is too weak. " + "; ".join(issues)
            raise ValidationException(detail=error_message)
        
        print(f"[VENDOR_SERVICE] Creating user account...")
        
        user_dict = {
            "email": vendor_data.email,
            "full_name": vendor_data.contact_person,
            "phone_number": vendor_data.phone_number,
            "role": "vendor",
            "hashed_password": hash_password(vendor_data.password),
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        user = await self.user_repo.create(user_dict)
        print(f"[VENDOR_SERVICE] User created with ID: {user.get('_id')}")
        
        print(f"[VENDOR_SERVICE] Creating vendor profile...")
       
        vendor_dict = vendor_data.model_dump(exclude={"password"})
        vendor_dict["user_id"] = user["_id"]
        vendor_dict["is_approved"] = True  
        vendor_dict["is_active"] = True
        vendor_dict["created_at"] = datetime.utcnow()
        vendor_dict["updated_at"] = datetime.utcnow()
        
        
        if "packages" not in vendor_dict or not vendor_dict["packages"]:
           
            category_prices = {
                "Photography": {"basic": 50000, "standard": 100000, "premium": 200000},
                "Caterer": {"basic": 80000, "standard": 150000, "premium": 300000},
                "Decorator": {"basic": 60000, "standard": 120000, "premium": 250000},
                "Venue": {"basic": 100000, "standard": 200000, "premium": 400000},
                "Makeup Artist": {"basic": 30000, "standard": 60000, "premium": 120000},
                "DJ": {"basic": 40000, "standard": 80000, "premium": 150000},
                "Florist": {"basic": 25000, "standard": 50000, "premium": 100000},
                "Mehndi": {"basic": 20000, "standard": 40000, "premium": 80000},
                "Videography": {"basic": 60000, "standard": 120000, "premium": 250000},
            }
            
            category = vendor_dict.get('service_category', 'Other')
            prices = category_prices.get(category, {"basic": 50000, "standard": 100000, "premium": 200000})
            
            vendor_dict["packages"] = [
                {
                    "name": "Basic",
                    "price": float(prices["basic"]),
                    "description": f"Basic {category} package - Perfect for intimate celebrations",
                    "features": [
                        "Standard service coverage",
                        "Basic setup and delivery",
                        "Digital documentation",
                        "Email support"
                    ]
                },
                {
                    "name": "Standard",
                    "price": float(prices["standard"]),
                    "description": f"Standard {category} package - Ideal for most weddings",
                    "features": [
                        "Enhanced service coverage",
                        "Extended hours",
                        "Premium delivery",
                        "Priority support",
                        "Additional team members"
                    ]
                },
                {
                    "name": "Premium",
                    "price": float(prices["premium"]),
                    "description": f"Premium {category} package - Luxury experience",
                    "features": [
                        "Full premium service",
                        "Complete coverage",
                        "Priority delivery",
                        "Dedicated support team",
                        "Exclusive features",
                        "Post-event follow-up"
                    ]
                }
            ]
        
        vendor = await self.vendor_repo.create(vendor_dict)
        print(f"[VENDOR_SERVICE] Vendor created successfully with ID: {vendor.get('_id')}")
        return vendor

