from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from app.services.user_service import UserService
from app.api.dependencies import get_user_service
from app.core.security import create_access_token
from app.core.config import settings
from app.models.user import UserCreate, UserResponse
from app.services.email_service import email_service
from pydantic import BaseModel, EmailStr
from app.core.password_validator import validate_password_strength, get_password_requirements
import secrets
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    user_service: UserService = Depends(get_user_service)
):
    try:
        user = await user_service.create_user(user_data)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/register-admin")
async def register_admin(
    user_data: UserCreate,
    user_service: UserService = Depends(get_user_service)
):
    """Register admin user after Clerk signup - creates/updates user in MongoDB with pending approval"""
    try:
        # Check if user already exists
        existing_user = await user_service.get_user_by_email(user_data.email)
        
        if existing_user:
            # Update existing user to admin role with pending approval
            if existing_user.get("role") == "admin":
                if existing_user.get("is_admin_approved") is False:
                    return {"message": "Admin registration already pending approval"}
                else:
                    return {"message": "Admin already approved"}
            else:
                # Update to admin role
                await user_service.user_repo.update(
                    str(existing_user["_id"]),
                    {
                        "role": "admin",
                        "is_admin_approved": False,
                        "is_active": False,
                        "updated_at": datetime.utcnow()
                    }
                )
                return {"message": "User updated to admin role with pending approval"}
        
        # Create new admin user
        user = await user_service.create_user(user_data)
        return {"message": "Admin registration submitted for approval", "user": user}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    user_service: UserService = Depends(get_user_service)
):
    try:
        print(f"[LOGIN ATTEMPT] Email: {form_data.username}")
        user_check = await user_service.user_repo.get_by_email(form_data.username)
        if user_check:
            print(f"[LOGIN CHECK] User found: {user_check.get('email')}, Role: {user_check.get('role')}, is_active: {user_check.get('is_active')}, is_admin_approved: {user_check.get('is_admin_approved')}")
            from app.core.security import verify_password
            hashed_pw = user_check.get("hashed_password")
            if hashed_pw is None:
                hashed_pw = ""

            if (user_check.get("role") == "admin" and
                user_check.get("is_admin_approved") is False and
                verify_password(form_data.password, hashed_pw)):
                print(f"[LOGIN BLOCKED] Admin not approved: {form_data.username}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your admin registration is pending approval. Please wait for an existing admin to approve your request.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

        user = await user_service.authenticate_user(form_data.username, form_data.password)
        if not user:
            print(f"[LOGIN FAILED] Authentication failed for: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        print(f"[LOGIN SUCCESS] User authenticated: {user.get('email')}, Role: {user.get('role')}")
        
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.get("_id") or user.get("id")), "role": user.get("role", "user")},
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.get("_id") or user.get("id")),
                "email": user.get("email", ""),
                "full_name": user.get("full_name", "User"),
                "role": user.get("role", "user")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f">>>>> [LOGIN ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        logger.error(f"[LOGIN ERROR] {type(e).__name__}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/check-email")
async def check_email(
    email_data: dict,
    user_service: UserService = Depends(get_user_service)
):
    email = email_data.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required")
    
    email = email.lower().strip()
    
    logger.info(f"[CHECK EMAIL] Checking email: {email}")
    
    from app.core.database import Database
    db = Database.get_database()
    
    user = await db["users"].find_one({"email": email})
    exists = user is not None
    
    logger.info(f"[CHECK EMAIL] Result: exists={exists}")
    
    return {"exists": exists}


@router.post("/check-password-strength")
async def check_password_strength(password_data: dict):
    password = password_data.get("password", "")
    
    if not password:
        return {
            "strength": "weak",
            "issues": ["Password cannot be empty"],
            "is_valid": False,
            "requirements": get_password_requirements()
        }
    
    strength, issues, is_valid = validate_password_strength(password)
    
    return {
        "strength": strength,
        "issues": issues,
        "is_valid": is_valid,
        "requirements": get_password_requirements()
    }


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    user_service: UserService = Depends(get_user_service)
):
    try:
        logger.info(f"[FORGOT PASSWORD] Request received for email: {request.email}")
        user = await user_service.get_user_by_email(request.email)
        
        if user:
            logger.info(f"[FORGOT PASSWORD] User found: {user.get('email')}")
            reset_token = secrets.token_urlsafe(32)
            logger.info(f"[FORGOT PASSWORD] Generated token: {reset_token[:20]}...")
            
            reset_expiry = datetime.utcnow() + timedelta(minutes=30)
            
            result = await user_service.user_repo.collection.update_one(
                {"email": user["email"]},
                {
                    "$set": {
                        "reset_token": reset_token,
                        "reset_token_expiry": reset_expiry
                    }
                }
            )
            logger.info(f"[FORGOT PASSWORD] Update result - matched: {result.matched_count}, modified: {result.modified_count}")
            
            logger.info(f"[FORGOT PASSWORD] Attempting to send email to: {request.email}")
            email_sent = await email_service.send_password_reset_email(
                to_email=request.email,
                reset_token=reset_token,
                user_name=user.get("full_name")
            )
            logger.info(f"[FORGOT PASSWORD] Email sent result: {email_sent}")
        else:
            logger.info(f"[FORGOT PASSWORD] No user found with email: {request.email}")
        
        return {"message": "If an account exists with this email, a password reset link has been sent"}
    
    except Exception as e:
        print(f"[FORGOT PASSWORD] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process password reset request"
        )


@router.post("/verify-reset-token")
async def verify_reset_token(
    request: dict,
    user_service: UserService = Depends(get_user_service)
):
    try:
        token = request.get("token")
        if not token:
            return {"valid": False, "reason": "No token provided"}
        
        user = await user_service.user_repo.collection.find_one({
            "reset_token": token
        })
        
        if not user:
            return {"valid": False, "reason": "Token not found in database"}
        
        if user.get("reset_token_expiry"):
            if datetime.utcnow() > user["reset_token_expiry"]:
                return {
                    "valid": False, 
                    "reason": "Token expired",
                    "expiry": user["reset_token_expiry"].isoformat(),
                    "current_time": datetime.utcnow().isoformat()
                }
        else:
            return {"valid": False, "reason": "No expiry time set"}
        
        return {
            "valid": True, 
            "email": user.get("email"),
            "expiry": user["reset_token_expiry"].isoformat()
        }
    
    except Exception as e:
        return {"valid": False, "reason": f"Error: {str(e)}"}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    user_service: UserService = Depends(get_user_service)
):
    try:
        logger.info(f"[RESET PASSWORD] Received token: {request.token[:20]}...")
        
        user = await user_service.user_repo.collection.find_one({
            "reset_token": request.token
        })
        
        logger.info(f"[RESET PASSWORD] User found: {user is not None}")
        
        if not user:
            all_users_with_tokens = await user_service.user_repo.collection.find(
                {"reset_token": {"$exists": True}},
                {"email": 1, "reset_token": 1, "reset_token_expiry": 1}
            ).to_list(length=10)
            logger.info(f"[RESET PASSWORD] Users with reset tokens: {len(all_users_with_tokens)}")
            for u in all_users_with_tokens:
                logger.info(f"[RESET PASSWORD] - Email: {u.get('email')}, Token: {u.get('reset_token', '')[:20]}..., Expiry: {u.get('reset_token_expiry')}")
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        if user.get("reset_token_expiry"):
            expiry_time = user["reset_token_expiry"]
            current_time = datetime.utcnow()
            logger.info(f"[RESET PASSWORD] Current time: {current_time}, Expiry time: {expiry_time}")
            
            if current_time > expiry_time:
                logger.info(f"[RESET PASSWORD] Token expired")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reset token has expired. Please request a new one"
                )
        else:
            logger.info(f"[RESET PASSWORD] No expiry time found")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )
        
        from app.core.password_validator import validate_password_strength
        strength, issues, is_valid = validate_password_strength(request.new_password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Password is too weak: {', '.join(issues)}"
            )
        
        from app.core.security import hash_password, verify_password
        old_hashed_password = user.get("hashed_password")
        if old_hashed_password and verify_password(request.new_password, old_hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password cannot be the same as your previous password"
            )
        
        hashed_password = hash_password(request.new_password)
        
        logger.info(f"[RESET PASSWORD] Resetting password for user: {user.get('email')}")
        result = await user_service.user_repo.collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"hashed_password": hashed_password},
                "$unset": {"reset_token": "", "reset_token_expiry": ""}
            }
        )
        logger.info(f"[RESET PASSWORD] Password updated - matched: {result.matched_count}, modified: {result.modified_count}")
        
        return {"message": "Password has been reset successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in reset_password: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )

