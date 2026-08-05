from typing import Optional, List
from datetime import datetime
from app.repositories.user_repository import UserRepository
from app.models.user import UserCreate, UserUpdate, UserResponse
from app.core.security import hash_password, verify_password
from app.core.password_validator import validate_password_strength
from app.core.exceptions import ValidationException


class UserService:
    
    
    def __init__(self, user_repository: UserRepository):
        self.user_repo = user_repository

    async def get_user_by_clerk_id(self, clerk_id: str):
        return await self.user_repo.find_by_field("clerk_id", clerk_id)

    async def sync_clerk_user(self, clerk_user_data: dict):
        """Sync a Clerk user into MongoDB. Creates or links to an existing record."""
        # Clerk JWTs use 'sub' for the user ID; callers may also pass 'id'
        clerk_id = clerk_user_data.get("sub") or clerk_user_data.get("id")
        if not clerk_id:
            return None

        # Return immediately if we already have a record for this Clerk user
        existing_user = await self.get_user_by_clerk_id(clerk_id)
        if existing_user:
            return existing_user

        email = (clerk_user_data.get("email") or "").lower().strip()

        # If a MongoDB user already exists with the same email, link the Clerk id
        if email:
            existing_email_user = await self.user_repo.get_by_email(email)
            if existing_email_user:
                await self.user_repo.update(str(existing_email_user["_id"]), {"clerk_id": clerk_id})
                existing_email_user["clerk_id"] = clerk_id
                return existing_email_user

        role = clerk_user_data.get("role") or "user"
        user_data = {
            "clerk_id": clerk_id,
            "full_name": clerk_user_data.get("full_name") or "Clerk User",
            "email": email,
            "role": role,
            "is_active": True,
            "is_admin_approved": False if role == "admin" else None,
            "hashed_password": None,  # Clerk-only users don't have a local password
            "created_at": clerk_user_data.get("created_at") or datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        return await self.user_repo.create(user_data)
    
    async def create_user(self, user_data: UserCreate) -> dict:
        existing_user = await self.user_repo.get_by_email(user_data.email)
        if existing_user:
            raise ValueError("User with this email already exists")
        
        strength, issues, is_valid = validate_password_strength(user_data.password)
        if not is_valid:
            error_message = "Password is too weak. " + "; ".join(issues)
            raise ValidationException(detail=error_message)
        
        hashed_password = hash_password(user_data.password)
        
        user_dict = user_data.model_dump(exclude={"password"})
        user_dict["hashed_password"] = hashed_password
        user_dict["is_active"] = True
        user_dict["created_at"] = datetime.utcnow()
        user_dict["updated_at"] = datetime.utcnow()
        
        if user_dict.get("role") == "admin":
            user_dict["is_admin_approved"] = False
            user_dict["is_active"] = False
        else:
            user_dict["is_admin_approved"] = None
        
        user = await self.user_repo.create(user_dict)
        
        if "_id" in user:
            user["id"] = str(user["_id"])
            del user["_id"]
        
        user.pop("hashed_password", None)
        user.pop("updated_at", None)
        
        return user
    
    async def get_user_by_id(self, user_id: str) -> Optional[dict]:
        return await self.user_repo.get_by_id(user_id)
    
    async def get_user_by_email(self, email: str) -> Optional[dict]:
        return await self.user_repo.get_by_email(email)
    
    async def update_user(self, user_id: str, user_data: UserUpdate) -> Optional[dict]:
        update_dict = user_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.utcnow()
        return await self.user_repo.update(user_id, update_dict)
    
    async def delete_user(self, user_id: str) -> bool:
        return await self.user_repo.delete(user_id)
    
    async def authenticate_user(self, email: str, password: str) -> Optional[dict]:
        user = await self.user_repo.get_by_email(email)
        if not user:
            return None

        hashed = user.get("hashed_password")
        # Clerk-only users have no local password — they cannot log in via this endpoint
        if not hashed:
            return None

        if not verify_password(password, hashed):
            return None

        if not user.get("is_active", True):
            return None

        if user.get("role") == "admin" and user.get("is_admin_approved") is False:
            return None

        user["id"] = str(user["_id"])
        return user
    
    async def update_password(self, user_id: str, old_password: str, new_password: str) -> Optional[dict]:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            return None
        
        if not verify_password(old_password, user.get("hashed_password")):
            raise ValueError("Incorrect old password")
        
        hashed_password = hash_password(new_password)
        update_dict = {
            "hashed_password": hashed_password,
            "updated_at": datetime.utcnow()
        }
        
        return await self.user_repo.update(user_id, update_dict)
