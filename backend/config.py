import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from dotenv import load_dotenv

# Get the directory of the current file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Force override to ensure .env values take precedence over any shell env vars
load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/thrifter")
    
    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me-in-production")
    JWT_EXP_SECONDS: int = int(os.getenv("JWT_EXP_SECONDS", "3600"))
    
    # Cloudinary
    CLOUDINARY_CLOUD_NAME: Optional[str] = os.getenv("CLOUDINARY_CLOUD_NAME")
    CLOUDINARY_API_KEY: Optional[str] = os.getenv("CLOUDINARY_API_KEY")
    CLOUDINARY_API_SECRET: Optional[str] = os.getenv("CLOUDINARY_API_SECRET")
    
    # App
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    SEED_DEMO: bool = os.getenv("SEED_DEMO", "False").lower() == "true"
    
    model_config = SettingsConfigDict(extra="ignore")

settings = Settings()
