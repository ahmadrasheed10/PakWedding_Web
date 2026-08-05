from fastapi import APIRouter, Depends, HTTPException, status
from app.services.user_service import UserService
from app.api.dependencies import get_user_service, get_current_user
from app.models.user import UserUpdate, UserResponse
from app.core.constants import MIN_PASSWORD_LENGTH, ERROR_USER_NOT_FOUND

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    # Normalize _id -> id so Pydantic UserResponse (which expects 'id') works correctly
    if "_id" in current_user and "id" not in current_user:
        current_user = {**current_user, "id": str(current_user["_id"])}
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
):
    updated_user = await user_service.update_user(current_user["_id"], user_data)
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_USER_NOT_FOUND)
    return updated_user


@router.put("/me/password", response_model=UserResponse)
async def update_password(
    password_data: dict,
    current_user: dict = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
):
    old_password = password_data.get("old_password")
    new_password = password_data.get("new_password")
    
    if not old_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both old_password and new_password are required"
        )
    
    if len(new_password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"New password must be at least {MIN_PASSWORD_LENGTH} characters long"
        )
    
    try:
        updated_user = await user_service.update_password(
            current_user["_id"],
            old_password,
            new_password
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_USER_NOT_FOUND)
    
    if "_id" in updated_user:
        updated_user["id"] = str(updated_user["_id"])
        del updated_user["_id"]
    
    updated_user.pop("hashed_password", None)
    
    return updated_user
