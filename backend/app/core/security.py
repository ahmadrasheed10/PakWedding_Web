import jwt
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib
import os
import base64
from app.core.config import settings
import asyncio

# Global cache for JWKS to avoid fetching it on every request
_jwks_cache = None
_jwks_cache_time = None
_jwks_lock = asyncio.Lock()

async def get_jwks():
    """Fetch the JWKS from Clerk with caching."""
    global _jwks_cache, _jwks_cache_time
    
    now = datetime.now(timezone.utc)
    if _jwks_cache and _jwks_cache_time and (now - _jwks_cache_time) < timedelta(hours=1):
        return _jwks_cache
        
    async with _jwks_lock:
        if _jwks_cache and _jwks_cache_time and (now - _jwks_cache_time) < timedelta(hours=1):
            return _jwks_cache
            
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(settings.CLERK_JWKS_URL)
                response.raise_for_status()
                _jwks_cache = response.json()
                _jwks_cache_time = now
                return _jwks_cache
        except Exception as e:
            print(f"[AUTH ERROR] Failed to fetch JWKS: {e}")
            return None

def get_jwks_sync():
    """Fetch the JWKS from Clerk in a synchronous context with caching."""
    global _jwks_cache, _jwks_cache_time
    now = datetime.now(timezone.utc)
    if _jwks_cache and _jwks_cache_time and (now - _jwks_cache_time) < timedelta(hours=1):
        return _jwks_cache

    try:
        response = httpx.get(settings.CLERK_JWKS_URL, timeout=5.0)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = now
        return _jwks_cache
    except Exception as e:
        print(f"[AUTH ERROR] Failed to fetch JWKS synchronously: {e}")
        return None


def hash_password(password: str) -> str:
    salt = base64.b64encode(os.urandom(32)).decode('utf-8')
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}:{base64.b64encode(key).decode('utf-8')}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        salt, key = hashed_password.split(':')
        new_key = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return base64.b64encode(new_key).decode('utf-8') == key
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm="HS256")


def _decode_clerk_token(token: str) -> Optional[dict]:
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get('kid')
        if not kid:
            return None

        jwks = get_jwks_sync()
        if not jwks:
            return None

        public_key = None
        for key in jwks.get('keys', []):
            if key.get('kid') == kid:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                break

        if not public_key:
            print("[AUTH ERROR] Matching public key not found in JWKS")
            return None

        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        return payload
    except Exception as e:
        print(f"[AUTH ERROR] Clerk token decode failed: {e}")
        return None


def decode_token(token: str) -> Optional[dict]:
    """Verify and decode a Clerk or local access token."""
    clerk_payload = _decode_clerk_token(token)
    if clerk_payload is not None:
        return clerk_payload

    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
    except Exception as e:
        print(f"[AUTH ERROR] Local token decode failed: {e}")
        return None
