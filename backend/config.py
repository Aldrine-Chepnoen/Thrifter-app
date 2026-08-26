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

    # Google Sign-In (web OAuth client ID, used to verify ID token audience)
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")

    # Google Maps Geocoding API (reverse-geocodes vendor "use my location" coordinates to an address)
    GOOGLE_MAPS_API_KEY: Optional[str] = os.getenv("GOOGLE_MAPS_API_KEY")

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

    # Pesapal (payments)
    PESAPAL_CONSUMER_KEY: Optional[str] = os.getenv("PESAPAL_CONSUMER_KEY")
    PESAPAL_CONSUMER_SECRET: Optional[str] = os.getenv("PESAPAL_CONSUMER_SECRET")
    PESAPAL_IPN_ID: Optional[str] = os.getenv("PESAPAL_IPN_ID")
    PESAPAL_ENV: str = os.getenv("PESAPAL_ENV", "sandbox")  # "sandbox" | "live"

    # Nylon Pay (payments)
    NYLONPAY_API_KEY: Optional[str] = os.getenv("NYLONPAY_API_KEY")
    NYLONPAY_API_SECRET: Optional[str] = os.getenv("NYLONPAY_API_SECRET")
    # Separate from the API secret — generated per API key under Dashboard > API
    # Settings > Webhook Configuration, used only to verify webhook signatures.
    NYLONPAY_WEBHOOK_SECRET: Optional[str] = os.getenv("NYLONPAY_WEBHOOK_SECRET")

    # Checkout / commerce
    DEFAULT_PAYMENT_PROVIDER: str = os.getenv("DEFAULT_PAYMENT_PROVIDER", "pesapal")
    DELIVERY_FEE_UGX: float = float(os.getenv("DELIVERY_FEE_UGX", "5000"))
    VENDOR_COMMISSION_RATE: float = float(os.getenv("VENDOR_COMMISSION_RATE", "0.05"))
    CHECKOUT_RESERVATION_MINUTES: int = int(os.getenv("CHECKOUT_RESERVATION_MINUTES", "20"))

    # Frontend base URL (used to build absolute links, e.g. vendor verification emails)
    FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

    # Backend's own public base URL (used for links that must resolve to a backend
    # route, e.g. /s/<code> short links — NOT the same host as FRONTEND_BASE_URL)
    BACKEND_BASE_URL: str = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")

    # App
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    SEED_DEMO: bool = os.getenv("SEED_DEMO", "False").lower() == "true"
    model_config = SettingsConfigDict(extra="ignore")

settings = Settings()
