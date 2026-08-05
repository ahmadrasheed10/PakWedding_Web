from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    
    DATABASE_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "PakWeddingDB"
    
    CLERK_SECRET_KEY: str = ""
    CLERK_JWKS_URL: str = ""
    JWT_SECRET_KEY: str = "replace_this_with_a_secure_secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000"]
    
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
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()

