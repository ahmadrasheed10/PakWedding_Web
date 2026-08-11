from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    
    DATABASE_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "PakWeddingDB"
    
    CLERK_SECRET_KEY: str = "sk_test_QmG208SbFzAxQAipKP0TE2HANTS8suNd3ighSVcom0"
    CLERK_JWKS_URL: str = "https://safe-mastiff-96.clerk.accounts.dev/.well-known/jwks.json"
    CLERK_PUBLISHABLE_KEY: str = "pk_test_c2FmZS1tYXN0aWZmLTk2LmNsZXJrLmFjY291bnRzLmRldiQ"
    JWT_SECRET_KEY: str = "9c4f4c95b8e63d3d77f65c0cdb5f3f8a7d8e0c2b1a6d9f4e3b7c8d1a2f5e6b9"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # CORS — includes localhost for dev + all Vercel deployment URLs for production
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://localhost:5174",
        "https://pak-wedding-web.vercel.app",
        "https://pak-wedding-web-frontend.vercel.app",
        "https://pak-wedding-c8uc28n3u-thejogs.vercel.app",
        "https://pak-wedding-web-frontend-xpc8rj3zz-thejogs.vercel.app",
    ]
    
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "PakWedding Portal"
    FRONTEND_URL: str = "http://localhost:3000"
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY")
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
