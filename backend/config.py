# This is the configuration file for the Thrifter backend application. It uses Pydantic's BaseSettings to manage environment variables and application settings. The settings include database connection details, JWT configuration, Cloudinary API credentials, and application-specific flags for debugging and seeding demo data. The configuration is designed to load values from a .env file, allowing for easy management of sensitive information and environment-specific settings without hardcoding them into the source code. The settings object can be imported and used throughout the application to access these configuration values in a consistent manner.
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
    
    # Cloudinary (fallback image store for ISPs that block the R2 domain)
    CLOUDINARY_CLOUD_NAME: Optional[str] = os.getenv("CLOUDINARY_CLOUD_NAME")
    CLOUDINARY_API_KEY: Optional[str] = os.getenv("CLOUDINARY_API_KEY")
    CLOUDINARY_API_SECRET: Optional[str] = os.getenv("CLOUDINARY_API_SECRET")

    # Cloudflare R2 (current image storage)
    R2_ACCOUNT_ID: Optional[str] = os.getenv("R2_ACCOUNT_ID")
    R2_ACCESS_KEY_ID: Optional[str] = os.getenv("R2_ACCESS_KEY_ID")
    R2_SECRET_ACCESS_KEY: Optional[str] = os.getenv("R2_SECRET_ACCESS_KEY")
    R2_BUCKET_NAME: Optional[str] = os.getenv("R2_BUCKET_NAME")
    R2_PUBLIC_BASE_URL: Optional[str] = os.getenv("R2_PUBLIC_BASE_URL")

    # PostHog server-side capture (public project key, same one the frontend uses)
    POSTHOG_PROJECT_API_KEY: Optional[str] = os.getenv("POSTHOG_PROJECT_API_KEY")
    POSTHOG_CAPTURE_HOST: str = os.getenv("POSTHOG_CAPTURE_HOST", "https://eu.i.posthog.com")

    # App
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    SEED_DEMO: bool = os.getenv("SEED_DEMO", "False").lower() == "true"
    model_config = SettingsConfigDict(extra="ignore")

settings = Settings()
