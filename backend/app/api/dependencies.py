from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime
from app.core.database import get_db
from app.core.security import decode_token
from app.repositories.user_repository import UserRepository
from app.repositories.vendor_repository import VendorRepository
from app.repositories.booking_repository import BookingRepository
from app.repositories.service_repository import ServiceRepository
from app.repositories.review_repository import ReviewRepository
from app.repositories.checklist_repository import ChecklistRepository
from app.repositories.favorite_repository import FavoriteRepository
from app.services.user_service import UserService
from app.services.vendor_service import VendorService
from app.services.booking_service import BookingService
from app.services.vendor_stats_service import VendorStatsService
from app.services.review_service import ReviewService
from app.services.checklist_service import ChecklistService
from app.services.favorite_service import FavoriteService
from app.services.chatbot_service import ChatbotService
import httpx
from app.core.config import settings

async def _fetch_clerk_user_info(user_id: str) -> dict:
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.clerk.com/v1/users/{user_id}",
                headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
                timeout=5.0
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"[AUTH] Failed to fetch clerk user info for {user_id}: {e}")
    return {}

async def _get_or_sync_clerk_user(user_id: str, payload: dict, user_service: UserService):
    user = await user_service.get_user_by_clerk_id(user_id)
    if user:
        return user

    email = payload.get("email") or ""
    if not email and payload.get("email_addresses"):
        email_addresses = payload.get("email_addresses") or []
        if isinstance(email_addresses, list) and email_addresses:
            first_email = email_addresses[0]
            if isinstance(first_email, dict):
                email = first_email.get("email_address") or first_email.get("email") or email
            elif isinstance(first_email, str):
                email = first_email

    public_metadata = payload.get("public_metadata") or {}
    unsafe_metadata = payload.get("unsafe_metadata") or {}
    metadata_role = (
        payload.get("role") or
        public_metadata.get("role") or
        unsafe_metadata.get("role") or
        "user"
    )

    first = payload.get("first_name") or payload.get("given_name") or ""
    last = payload.get("last_name") or payload.get("family_name") or ""
    if not first and not last:
        name = payload.get("name") or payload.get("full_name") or ""
        name_parts = name.split() if isinstance(name, str) else []
        first = name_parts[0] if name_parts else ""
        last = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
    full_name = f"{first} {last}".strip() or payload.get("name") or payload.get("full_name") or "Clerk User"

    if not email or full_name == "Clerk User":
        clerk_info = await _fetch_clerk_user_info(user_id)
        if clerk_info:
            if not email:
                emails = clerk_info.get("email_addresses", [])
                primary_id = clerk_info.get("primary_email_address_id")
                for em in emails:
                    if em.get("id") == primary_id:
                        email = em.get("email_address")
                        break
                if not email and emails:
                    email = emails[0].get("email_address")
            if full_name == "Clerk User":
                first = clerk_info.get("first_name") or ""
                last = clerk_info.get("last_name") or ""
                full_name = f"{first} {last}".strip() or "Clerk User"

    user_data = {
        "sub": user_id,
        "email": email,
        "full_name": full_name,
        "role": metadata_role,
        "is_active": True,
        "created_at": datetime.utcfromtimestamp(payload["iat"]) if payload.get("iat") else datetime.utcnow(),
    }
    return await user_service.sync_clerk_user(user_data)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_user_repository(db = Depends(get_db)):
    return UserRepository(db)


async def get_vendor_repository(db = Depends(get_db)):
    return VendorRepository(db)


async def get_booking_repository(db = Depends(get_db)):
    return BookingRepository(db)


async def get_service_repository(db = Depends(get_db)):
    return ServiceRepository(db)


async def get_review_repository(db = Depends(get_db)):
    return ReviewRepository(db)


async def get_checklist_repository(db = Depends(get_db)):
    return ChecklistRepository(db)


async def get_favorite_repository(db = Depends(get_db)):
    return FavoriteRepository(db)


async def get_user_service(user_repo: UserRepository = Depends(get_user_repository)):
    return UserService(user_repo)


async def get_vendor_service(
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
    user_repo: UserRepository = Depends(get_user_repository)
):
    return VendorService(vendor_repo, user_repo)


async def get_booking_service(booking_repo: BookingRepository = Depends(get_booking_repository)):
    return BookingService(booking_repo)


async def get_vendor_stats_service(
    vendor_repo: VendorRepository = Depends(get_vendor_repository),
    booking_repo: BookingRepository = Depends(get_booking_repository),
    review_repo: ReviewRepository = Depends(get_review_repository)
):
    return VendorStatsService(vendor_repo, booking_repo, review_repo)


async def get_review_service(
    review_repo: ReviewRepository = Depends(get_review_repository),
    user_repo: UserRepository = Depends(get_user_repository),
    booking_repo: BookingRepository = Depends(get_booking_repository)
):
    return ReviewService(review_repo, user_repo, booking_repo)


async def get_checklist_service(
    checklist_repo: ChecklistRepository = Depends(get_checklist_repository)
):
    return ChecklistService(checklist_repo)


async def get_favorite_service(
    favorite_repo: FavoriteRepository = Depends(get_favorite_repository)
):
    return FavoriteService(favorite_repo)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    user_service: UserService = Depends(get_user_service)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_token(token)
    if payload is None:
        print(f"[AUTH ERROR] Token decode returned None for token: {token[:20]}...")
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    issuer = payload.get("iss", "")
    is_clerk_token = isinstance(issuer, str) and "clerk" in issuer

    user = None
    if is_clerk_token:
        user = await _get_or_sync_clerk_user(user_id, payload, user_service)
    else:
        user = await user_service.get_user_by_id(user_id)

    if user is None:
        raise credentials_exception
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact an administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_current_vendor(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "vendor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_optional_current_user(
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)),
    user_service: UserService = Depends(get_user_service)
):
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload is None:
            return None
        user_id: str = payload.get("sub")
        if user_id is None:
            return None

        issuer = payload.get("iss", "")
        is_clerk_token = isinstance(issuer, str) and "clerk" in issuer

        user = None
        if is_clerk_token:
            user = await _get_or_sync_clerk_user(user_id, payload, user_service)
        else:
            user = await user_service.get_user_by_id(user_id)
        
        return user
    except Exception as e:
        print(f"[OPTIONAL USER ERROR] {e}")
        return None
