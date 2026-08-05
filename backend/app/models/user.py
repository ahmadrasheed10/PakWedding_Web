from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_serializer
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema

        def validate(value) -> ObjectId:
            if isinstance(value, ObjectId):
                return value
            if isinstance(value, str):
                if ObjectId.is_valid(value):
                    return ObjectId(value)
                raise ValueError("Invalid ObjectId string")
            raise ValueError("Invalid ObjectId")

        return core_schema.no_info_plain_validator_function(validate)


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    role: str = "user"


class UserCreate(UserBase):
    password: str
    
    @classmethod
    def model_validate(cls, obj):
        if isinstance(obj, dict) and 'password' in obj:
            obj['password'] = obj['password'][:72]
        return super().model_validate(obj)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None


class UserInDB(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    hashed_password: str
    is_active: bool = True
    is_admin_approved: Optional[bool] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @field_serializer('id')
    def serialize_id(self, value: PyObjectId) -> str:
        return str(value)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class UserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    role: str = "user"
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

