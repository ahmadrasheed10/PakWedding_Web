from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from pymongo import ReturnDocument
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
        """Atomically sync a Clerk user into MongoDB without race condition duplicates."""
        clerk_id = clerk_user_data.get("sub") or clerk_user_data.get("id")
        if not clerk_id:
            return None

        email = (clerk_user_data.get("email") or "").lower().strip()
        desired_role = clerk_user_data.get("role") or "user"
        full_name = clerk_user_data.get("full_name") or "Clerk User"
        now = datetime.utcnow()

        # Check by clerk_id or email
        filter_query = {"$or": [{"clerk_id": clerk_id}]}
        if email:
            filter_query["$or"].append({"email": email})

        existing_user = await self.user_repo.collection.find_one(filter_query)
        if existing_user:
            updates = {
                "clerk_id": clerk_id,
                "updated_at": now
            }
            if email and not existing_user.get("email"):
                updates["email"] = email
            if full_name and full_name != "Clerk User" and existing_user.get("full_name") in (None, "Clerk User", ""):
                updates["full_name"] = full_name
            if desired_role != "user" and existing_user.get("role") == "user":
                updates["role"] = desired_role

            await self.user_repo.collection.update_one(
                {"_id": existing_user["_id"]},
                {"$set": updates}
            )
            existing_user.update(updates)
            existing_user["_id"] = str(existing_user["_id"])
            return existing_user

        # If not found, insert atomically using find_one_and_update with upsert
        user_doc = {
            "clerk_id": clerk_id,
            "full_name": full_name,
            "email": email,
            "role": desired_role,
            "is_active": True,
            "is_admin_approved": False if desired_role == "admin" else None,
            "hashed_password": None,
            "created_at": clerk_user_data.get("created_at") or now,
            "updated_at": now,
        }

        try:
            res = await self.user_repo.collection.find_one_and_update(
                {"clerk_id": clerk_id},
                {"$setOnInsert": user_doc},
                upsert=True,
                return_document=ReturnDocument.AFTER
            )
            if res:
                res["_id"] = str(res["_id"])
                return res
        except Exception:
            # If concurrent race condition occurs, fetch existing
            user = await self.user_repo.collection.find_one(filter_query)
            if user:
                user["_id"] = str(user["_id"])
                return user

        user = await self.get_user_by_clerk_id(clerk_id)
        if user and "_id" in user:
            user["_id"] = str(user["_id"])
        return user
    
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
