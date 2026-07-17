# This is the main application file for the Thrifter backend API. It sets up the FastAPI application, configures database connections, defines API endpoints for user authentication, item management, and search functionality. The application uses SQLAlchemy for database interactions, Cloudinary for image storage, and a custom search engine for generating image embeddings and performing similarity searches. The code also includes structured logging, error handling, and rate limiting to ensure a robust and secure API. Additionally, there are utility functions for password hashing, JWT token management, and seeding demo data for testing purposes. 
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Header, Response, Request, BackgroundTasks
import asyncio
from fastapi.responses import JSONResponse
import logging
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, defer, selectinload
from sqlalchemy import or_, func, case
from sqlalchemy.orm import joinedload
import shutil
import os
import uuid
import io
from typing import List, Optional
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import json
import re
import urllib.request
from PIL import Image, ImageDraw
from sqlalchemy import text

from database import get_db, engine, Base, SessionLocal
import models
import schemas
import search_engine
import cache

# Tables are managed by Alembic migrations
# models.Base.metadata.create_all(bind=engine)

import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url
import storage

from config import settings

# Configure Cloudinary
cloudinary.config(
    cloud_name = settings.CLOUDINARY_CLOUD_NAME,
    api_key = settings.CLOUDINARY_API_KEY,
    api_secret = settings.CLOUDINARY_API_SECRET,
    secure = True
)

app = FastAPI(title="Thrifter API")

from logging_config import setup_logging
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError

# Configure structured logging
logger = setup_logging(level="DEBUG" if settings.DEBUG else "INFO")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}", extra={"path": request.url.path})
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation Error", "errors": str(exc.errors())}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP exception: {exc.detail}", extra={"status_code": exc.status_code, "path": request.url.path})
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error: {str(exc)}", exc_info=True, extra={"path": request.url.path})
    return JSONResponse(
        status_code=500,
        content={"detail": "Database Error", "message": "An unexpected database error occurred."}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {str(exc)}", exc_info=True, extra={"path": request.url.path})
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc) if settings.DEBUG else "An unexpected error occurred."}
    )

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.get("/features")
def get_features(db: Session = Depends(get_db)):
    promo_setting = db.query(models.AppSetting).filter(models.AppSetting.key == "promo_10k_enabled").first()
    return {
        "promo_10k_enabled": promo_setting.value_bool if promo_setting else False,
    }

# Mount images directory
IMAGES_DIR = "images"
if not os.path.exists(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

# Global search engine
from search_engine import SearchEngine
search_engine = SearchEngine()

import hashlib
import hmac
import base64
import time
import urllib.request
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = settings.JWT_SECRET
JWT_EXP_SECONDS = settings.JWT_EXP_SECONDS
SEED_DEMO = settings.SEED_DEMO

def format_whatsapp_number(number: str) -> str:
    if not number:
        return ""
    # Remove all spaces, dashes, brackets
    number = number.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    
    # Already has correct format
    if number.startswith("+256"):
        return number
    
    # Has 256 without the +
    if number.startswith("256"):
        return "+" + number
    
    # Local format starting with 0 (e.g. 0772123456)
    if number.startswith("0"):
        return "+256" + number[1:]
    
    # Just the 9 digit number (e.g. 772123456)
    if len(number) == 9:
        return "+256" + number
    
    return number

def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)

def verify_password(pw: str, hashed: str) -> bool:
    return pwd_context.verify(pw, hashed)

import jwt
from datetime import datetime, timedelta

def make_token(payload: dict) -> str:
    payload = dict(payload)
    payload["exp"] = datetime.utcnow() + timedelta(seconds=JWT_EXP_SECONDS)
    payload["iat"] = datetime.utcnow()
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def parse_token(token: str, db: Session) -> dict:
    try:
        # Check blacklist
        blacklisted = db.query(models.BlacklistedToken).filter(models.BlacklistedToken.token == token).first()
        if blacklisted:
            raise HTTPException(status_code=401, detail="Token has been revoked")
            
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    # Token validation + blacklist check always runs — never cached
    payload = parse_token(token, db)
    uid = payload.get("uid")

    cached = cache.user_get(uid)
    if cached is not None:
        return cached

    user = db.query(models.User).filter(models.User.id == uid).first()
    if user:
        cached_user = cache.CachedUser(
            id=user.id,
            email=user.email,
            is_vendor=user.is_vendor,
            is_admin=user.is_admin,
            vendor_id=user.vendor_id,
        )
        cache.user_set(uid, cached_user)
        return cached_user
    return None

def require_admin(current_user: Optional[models.User] = Depends(get_current_user)) -> models.User:
    if not current_user or not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def get_optional_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """Silently attempts to get user, returns None if auth fails or token is missing."""
    try:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header.replace("Bearer ", "")
        payload = parse_token(token, db)
        user = db.query(models.User).filter(
            models.User.id == payload.get("uid")
        ).first()
        return user
    except Exception:
        return None

@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=400, detail="No token provided")
    token = authorization.split(" ", 1)[1]
    
    # Add to blacklist
    blacklisted = models.BlacklistedToken(token=token, blacklisted_on=time.time())
    db.add(blacklisted)
    db.commit()
    logger.info("User logged out, token blacklisted")
    return {"message": "Logged out successfully"}

def seed_demo_data(db: Session):
    if db.query(models.Item).count() > 0:
        return
    vendor = db.query(models.Vendor).filter(models.Vendor.name == "Demo Vendor").first()
    if not vendor:
        vendor = models.Vendor(name="Demo Vendor", whatsapp="+2348000000000")
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
    items = [
        {"name": "Vintage Denim Jacket", "price": 150000.0, "size": "M", "market": "Yaba", "url": "https://images.unsplash.com/photo-1516826957135-0b3a29f9c6aa?q=80&w=800&auto=format&fit=crop"},
        {"name": "Classic Blazer", "price": 320000.0, "size": "L", "market": "Kampala", "url": "https://images.unsplash.com/photo-1520974741222-0d24bd5f4a30?q=80&w=800&auto=format&fit=crop"},
        {"name": "Mesh Top", "price": 90000.0, "size": "S", "market": "Ikeja", "url": "https://images.unsplash.com/photo-1520975693418-4596b06eb8b4?q=80&w=800&auto=format&fit=crop"},
        {"name": "Minimalist Sneakers", "price": 280000.0, "size": "42", "market": "Surulere", "url": "https://images.unsplash.com/photo-1519741491150-2916f67b63a4?q=80&w=800&auto=format&fit=crop"},
        {"name": "Quarterzip Sweater", "price": 120000.0, "size": "XL", "market": "Yaba", "url": "https://images.unsplash.com/photo-1578939662863-5cd416d45a69?q=80&w=800&auto=format&fit=crop"}
    ]
    if not os.path.exists(IMAGES_DIR):
        os.makedirs(IMAGES_DIR)
    for idx, d in enumerate(items, start=1):
        filename = f"demo_{idx}.jpg"
        path = os.path.join(IMAGES_DIR, filename)
        try:
            urllib.request.urlretrieve(d["url"], path)
        except Exception:
            img = Image.new("RGB", (800, 1000), (230, 230, 230))
            img.save(path)
        
        # Also need embedding for demo items
        try:
            with open(path, "rb") as f:
                emb = search_engine.get_image_embedding_from_file(f)
        except Exception:
            emb = np.zeros(512)

        db_item = models.Item(
            name=d["name"],
            price=d["price"],
            size=d["size"],
            market=d["market"],
            description=None,
            image_path=filename,
            vendor_id=vendor.id,
            embedding=emb.tolist()
        )
        db.add(db_item)
    db.commit()

def cleanup_demo_items(db: Session):
    try:
        demo_vendor = db.query(models.Vendor).filter(models.Vendor.name == "Demo Vendor").first()
        if not demo_vendor:
            return
        # Fetch items for demo vendor
        demo_items = db.query(models.Item).filter(models.Item.vendor_id == demo_vendor.id).all()
        demo_item_ids = [it.id for it in demo_items]
        # Delete image files
        for it in demo_items:
            try:
                if it.image_path and os.path.exists(it.image_path):
                    os.remove(it.image_path)
            except Exception:
                pass
        # Remove items
        for it in demo_items:
            db.delete(it)
        db.commit()
        # Remove vendor
        db.delete(demo_vendor)
        db.commit()
        # Remove any leftover demo_* files in images
        try:
            for fname in os.listdir(IMAGES_DIR):
                if fname.startswith("demo_"):
                    fpath = os.path.join(IMAGES_DIR, fname)
                    if os.path.isfile(fpath):
                        os.remove(fpath)
        except Exception:
            pass
    except Exception as e:
        logger.error(f"Cleanup demo items failed: {e}")

import clustering

def _run_style_discovery_task():
    db = SessionLocal()
    try:
        clustering.run_clustering(db, search_engine)
        # Update last run timestamp
        last_run = db.query(models.AppSetting).filter(models.AppSetting.key == "last_style_discovery").first()
        if not last_run:
            last_run = models.AppSetting(key="last_style_discovery", value_float=time.time())
            db.add(last_run)
        else:
            last_run.value_float = time.time()
        db.commit()
    except Exception as e:
        logger.error(f"Style discovery task failed: {e}")
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    db = next(get_db())
    if SEED_DEMO:
        logger.info("Seeding demo data...")
        seed_demo_data(db)
    
    # Check if we should run style discovery (every 2 days)
    last_run_setting = db.query(models.AppSetting).filter(models.AppSetting.key == "last_style_discovery").first()
    now = time.time()
    two_days_sec = 2 * 24 * 60 * 60
    
    if not last_run_setting or (now - (last_run_setting.value_float or 0)) > two_days_sec:
        logger.info("Starting initial style discovery...")
        # Run in a separate thread/task so startup isn't blocked
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, _run_style_discovery_task)

@app.get("/outfit-styles", response_model=List[schemas.StyleCategory])
def get_outfit_styles(db: Session = Depends(get_db), current_user = Depends(get_optional_user)):
    """Returns approved styles for users, and all styles for admins."""
    if current_user and current_user.is_admin:
        styles = db.query(models.StyleCategory).order_by(models.StyleCategory.is_approved.asc(), models.StyleCategory.id.desc()).all()
    else:
        styles = db.query(models.StyleCategory).filter(models.StyleCategory.is_approved == True).all()

    result = []
    for style in styles:
        sample_items = []
        if not style.cover_image_path:
            sample_ids = json.loads(style.sample_item_ids or '[]')[:3]
            if sample_ids:
                items_q = (
                    db.query(models.Item)
                    .options(defer(models.Item.embedding), selectinload(models.Item.images), selectinload(models.Item.vendor))
                    .filter(models.Item.id.in_(sample_ids))
                    .all()
                )
                item_map = {i.id: i for i in items_q}
                sample_items = [serialize_item(item_map[sid]) for sid in sample_ids if sid in item_map]
        result.append(schemas.StyleCategory(
            id=style.id,
            name=style.name,
            slug=style.slug,
            description=style.description,
            is_approved=style.is_approved,
            sample_item_ids=style.sample_item_ids,
            cover_image_path=style.cover_image_path,
            cover_cloudinary_id=style.cover_cloudinary_id,
            cover_fallback_url=cloudinary_fallback_url(style.cover_cloudinary_id)
                if storage.is_r2_url(style.cover_image_path) else None,
            top_cluster_id=style.top_cluster_id,
            bottom_cluster_id=style.bottom_cluster_id,
            accessory_cluster_id=style.accessory_cluster_id,
            created_at=style.created_at,
            updated_at=style.updated_at,
            sample_items=sample_items,
        ))
    return result

@app.get("/outfit-styles/{slug}/items", response_model=schemas.StyleCategoryItems)
def get_style_items(slug: str, db: Session = Depends(get_db)):
    """Returns curated pools of items for a style builder based on linked clusters."""
    style = db.query(models.StyleCategory).filter(models.StyleCategory.slug == slug).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    
    def get_cluster_items(cluster: models.VisualCluster, item_type: str, limit: int = 8):
        if not cluster or cluster.centroid_embedding is None:
            return []
        
        centroid_str = "[" + ",".join(str(x) for x in cluster.centroid_embedding) + "]"
        return (
            db.query(models.Item)
            .options(defer(models.Item.embedding), selectinload(models.Item.images), selectinload(models.Item.vendor))
            .filter(models.Item.item_type == item_type)
            .filter(models.Item.embedding.isnot(None))
            .order_by(text(f"embedding <=> '{centroid_str}'::vector"))
            .limit(limit)
            .all()
        )

    return schemas.StyleCategoryItems(
        tops=[serialize_item(i) for i in get_cluster_items(style.top_cluster, "top")],
        bottoms=[serialize_item(i) for i in get_cluster_items(style.bottom_cluster, "bottom")],
        accessories=[serialize_item(i) for i in get_cluster_items(style.accessory_cluster, "accessory")]
    )

@app.post("/auth/register", response_model=schemas.UserInfo)
@limiter.limit("5/minute")
def register(request: Request, user: schemas.UserCreate, db: Session = Depends(get_db)):
    logger.info(f"Registering new user: {user.email}")
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        logger.warning(f"Registration failed: Email {user.email} already exists")
        raise HTTPException(status_code=400, detail="Email already registered")
    vendor_id = None
    vendor_name = None
    vendor_whatsapp = None
    if user.is_vendor:
        name = user.vendor_name or user.email.split("@")[0]
        whatsapp = format_whatsapp_number(user.vendor_whatsapp or "")
        vendor = db.query(models.Vendor).filter(models.Vendor.name == name).first()
        if not vendor:
            vendor = models.Vendor(name=name, whatsapp=whatsapp)
            db.add(vendor)
            db.commit()
            db.refresh(vendor)
        vendor_id = vendor.id
        vendor_name = vendor.name
        vendor_whatsapp = vendor.whatsapp
    u = models.User(email=user.email, hashed_password=hash_password(user.password), is_vendor=user.is_vendor, vendor_id=vendor_id)
    db.add(u)
    db.commit()
    db.refresh(u)
    logger.info(f"User registered successfully: {u.id}")
    return schemas.UserInfo(id=u.id, email=u.email, is_vendor=u.is_vendor, vendor_name=vendor_name, vendor_whatsapp=vendor_whatsapp)

@app.post("/auth/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(request: Request, email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    logger.info(f"Login attempt: {email}")
    if len(password) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 chars)")
    u = db.query(models.User).filter(models.User.email == email).first()
    if not u or not verify_password(password, u.hashed_password):
        logger.warning(f"Login failed: Invalid credentials for {email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = make_token({"uid": u.id})
    logger.info(f"Login successful: {u.id}")
    return schemas.Token(access_token=token)

@app.get("/auth/me", response_model=schemas.UserInfo)
def me(current = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current:
        raise HTTPException(status_code=401, detail="Unauthorized")

    cached = cache.me_get(current.id)
    if cached is not None:
        return cached

    vendor_name = None
    vendor_whatsapp = None
    if current.vendor_id:
        v = db.query(models.Vendor).filter(models.Vendor.id == current.vendor_id).first()
        if v:
            vendor_name = v.name
            vendor_whatsapp = v.whatsapp

    result = schemas.UserInfo(
        id=current.id, email=current.email,
        is_vendor=current.is_vendor, is_admin=current.is_admin,
        vendor_name=vendor_name, vendor_whatsapp=vendor_whatsapp
    )
    cache.me_set(current.id, result)
    return result

def validate_item_fields(name: str, description: Optional[str]) -> str:
    """Form fields bypass Pydantic body validation, so enforce the same limits
    as schemas.ItemBase here. Returns the cleaned name."""
    name = name.strip()
    if not (2 <= len(name) <= 100):
        raise HTTPException(status_code=400, detail="Item name must be between 2 and 100 characters")
    if description and len(description) > 1000:
        raise HTTPException(status_code=400, detail="Description must be at most 1000 characters")
    return name


def _posthog_capture(event: str, properties: dict) -> None:
    """Best-effort server-side PostHog event. Never raises."""
    if not settings.POSTHOG_PROJECT_API_KEY:
        return
    try:
        body = json.dumps({
            "api_key": settings.POSTHOG_PROJECT_API_KEY,
            "event": event,
            "distinct_id": "backend",
            "properties": properties,
        }).encode()
        req = urllib.request.Request(
            f"{settings.POSTHOG_CAPTURE_HOST}/capture/",
            data=body,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        logger.warning(f"PostHog capture failed for {event}: {e}")


def cloudinary_backup(image_bytes: bytes, folder: str, context: str) -> Optional[str]:
    """Best-effort upload of an original to Cloudinary — the fallback store for
    users on ISPs that block the R2 domain. Returns the public_id, or None on
    failure: the asset then simply has no fallback until backfilled (rows with
    a NULL cloudinary_public_id are the backfill worklist). Never raises."""
    if not settings.CLOUDINARY_CLOUD_NAME:
        return None
    try:
        result = cloudinary.uploader.upload(
            io.BytesIO(image_bytes),
            folder=folder,
            # Cap stored size: the fallback never serves wider than w800
            transformation=[{"width": 1000, "crop": "limit"}, {"quality": "auto"}],
        )
        return result["public_id"]
    except Exception as e:
        logger.warning(f"Cloudinary backup failed ({context}): {e}")
        _posthog_capture("cloudinary_backup_failed", {"context": context, "error": str(e)[:300]})
        return None


def cloudinary_fallback_url(public_id: Optional[str]) -> Optional[str]:
    if not public_id or not settings.CLOUDINARY_CLOUD_NAME:
        return None
    return cloudinary_url(public_id, secure=True)[0]


def serialize_item(item: models.Item) -> schemas.Item:
    vendor_name = item.vendor.name if item.vendor else None
    vendor_whatsapp = item.vendor.whatsapp if item.vendor else None

    images = []
    if hasattr(item, 'images'):
        images = [
            schemas.ItemImage(
                id=img.id,
                image_path=img.image_path,
                cloudinary_public_id=img.cloudinary_public_id,
                # Only R2-era images need a fallback; legacy paths already point at Cloudinary
                fallback_url=cloudinary_fallback_url(img.cloudinary_public_id)
                    if storage.is_r2_url(img.image_path) else None,
                is_primary=img.is_primary
            ) for img in item.images
        ]

    primary_image = next((img for img in images if img.is_primary), None)
    if not primary_image and images:
        primary_image = images[0]

    display_image_path = primary_image.image_path if primary_image else item.image_path
    display_cloudinary_id = primary_image.cloudinary_public_id if primary_image else item.cloudinary_public_id
    if primary_image:
        display_fallback_url = primary_image.fallback_url
    elif storage.is_r2_url(item.image_path):
        display_fallback_url = cloudinary_fallback_url(item.cloudinary_public_id)
    else:
        display_fallback_url = None

    return schemas.Item(
        id=item.id,
        # Truncate defensively: one over-long row must never 500 a whole feed
        name=(item.name or "")[:100],
        price=item.price,
        size=item.size,
        market=item.market,
        item_type=item.item_type or "top",
        description=item.description[:1000] if item.description else None,
        image_path=display_image_path,
        cloudinary_public_id=display_cloudinary_id,
        fallback_url=display_fallback_url,
        images=images,
        vendor_name=vendor_name,
        vendor_whatsapp=vendor_whatsapp,
        whatsapp=vendor_whatsapp or None
    )

def _personalised_feed(
    db: Session,
    wardrobe_items,
    user_id: int,
    skip: int,
    limit: int,
    seed: float,
    base_query
):
    import numpy as np

    # 1. Fetch wardrobe item embeddings
    wardrobe_item_ids = [w.item_id for w in wardrobe_items]
    
    items_with_embeddings = (
        db.query(models.Item)
        .filter(models.Item.id.in_(wardrobe_item_ids))
        .filter(models.Item.embedding.isnot(None))
        .all()
    )

    if not items_with_embeddings:
        # No embeddings available — fall back to random
        db.execute(text(f"SELECT setseed({seed})"))
        return base_query.order_by(func.random()).offset(skip).limit(limit).all()

    # 2. Build weighted style profile (linear recency bias)
    # wardrobe_items is ordered by id desc (most recent first)
    n = len(items_with_embeddings)
    
    id_to_rank = {
        w.item_id: (len(wardrobe_items) - idx)  # rank n down to 1
        for idx, w in enumerate(wardrobe_items)
    }

    total_weight = 0.0
    profile_vector = np.zeros(512, dtype=np.float64)

    for item in items_with_embeddings:
        weight = id_to_rank.get(item.id, 1)
        emb = np.array(item.embedding, dtype=np.float64)
        profile_vector += weight * emb
        total_weight += weight

    profile_vector /= total_weight

    # Normalise the profile vector
    norm = np.linalg.norm(profile_vector)
    if norm > 0:
        profile_vector /= norm

    profile_str = "[" + ",".join(str(x) for x in profile_vector.tolist()) + "]"

    # 3. Determine discovery mix ratio
    # Gradual fade: page 1 = 90% similar, fades to 10% by page 10+
    page = (skip // limit) + 1 if limit > 0 else 1
    similar_ratio = max(0.1, 0.9 - (page - 1) * 0.08)
    similar_count = round(limit * similar_ratio)
    random_count = limit - similar_count

    # 4. IDs to exclude
    exclude_ids = set(wardrobe_item_ids)

    # 5. Fetch similar items
    similar_items = (
        base_query
        .filter(models.Item.embedding.isnot(None))
        .filter(~models.Item.id.in_(exclude_ids))
        .order_by(
            text(f"embedding <=> '{profile_str}'::vector")
        )
        .offset(skip)
        .limit(similar_count)
        .all()
    )

    # If the embedding pool is shallower than skip+similar_count, fill the gap
    # with extra random items so the page always reaches `limit` items
    actual_random_count = limit - len(similar_items)
    similar_ids = {i.id for i in similar_items}

    # 6. Fetch random discovery items (exclude already-included similar items)
    db.execute(text(f"SELECT setseed({seed})"))
    random_items = (
        base_query
        .filter(~models.Item.id.in_(exclude_ids | similar_ids))
        .order_by(func.random())
        .offset(skip)
        .limit(actual_random_count)
        .all()
    )

    # 7. Merge
    result = similar_items + random_items

    # 8. Infinite scroll safety net
    if not result:
        db.execute(text(f"SELECT setseed({seed})"))
        result = (
            base_query
            .filter(~models.Item.id.in_(exclude_ids))
            .order_by(func.random())
            .offset(skip)
            .limit(limit)
            .all()
        )

    return result

@app.get("/items", response_model=List[schemas.Item])
def read_items(
    skip: int = 0,
    limit: int = 100,
    vendor: Optional[str] = None,
    seed: Optional[float] = None,
    sort: str = "random",
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Check feed cache
    user_segment = f"u{current_user.id}" if current_user else "anon"
    price_key = f"{int(min_price) if min_price is not None else ''}_{int(max_price) if max_price is not None else ''}"
    feed_key = f"{user_segment}:{skip}:{limit}:{sort}:{vendor or ''}:{round(seed or 0.5, 6)}:{price_key}"
    cached_feed = cache.feed_get(feed_key)
    if cached_feed is not None:
        return cached_feed

    # Base query
    query = db.query(models.Item).options(
        defer(models.Item.embedding),
        selectinload(models.Item.images),
        selectinload(models.Item.vendor),
    )

    if vendor:
        # Allow a vendor to see their own items even when their account is hidden
        is_own_vendor = bool(
            current_user and current_user.vendor_id and
            db.query(models.Vendor).filter(
                models.Vendor.id == current_user.vendor_id,
                models.Vendor.name.ilike(f"%{vendor}%")
            ).first()
        )
        query = query.join(models.Vendor).filter(models.Vendor.name.ilike(f"%{vendor}%"))
        if not is_own_vendor:
            query = query.filter(models.Vendor.is_active == True)
    else:
        # General feed — hide items from inactive vendors
        query = (query
            .outerjoin(models.Vendor, models.Item.vendor_id == models.Vendor.id)
            .filter(or_(models.Item.vendor_id == None, models.Vendor.is_active == True))
        )

    # Price range filter (also caps promo tab to ≤ 10 000 UGX)
    if sort == "promo":
        query = query.filter(models.Item.price <= 10000)
    if min_price is not None:
        query = query.filter(models.Item.price >= min_price)
    if max_price is not None:
        query = query.filter(models.Item.price <= max_price)

    # Vendor pages don't need personalisation or random ordering — newest first
    if vendor:
        items = query.order_by(models.Item.id.desc()).offset(skip).limit(limit).all()
        response = [serialize_item(i) for i in items]
        cache.feed_set(feed_key, response)
        return response

    # Personalized feed — only when explicitly requested via sort=for_you
    if sort == "for_you" and current_user:
        try:
            wardrobe_items = (
                db.query(models.Wardrobe)
                .filter(models.Wardrobe.user_id == current_user.id)
                .order_by(models.Wardrobe.id.desc())
                .limit(15)
                .all()
            )

            if wardrobe_items:
                results = _personalised_feed(
                    db=db,
                    wardrobe_items=wardrobe_items,
                    user_id=current_user.id,
                    skip=skip,
                    limit=limit,
                    seed=seed or 0.5,
                    base_query=query
                )
                response = [serialize_item(i) for i in results]
                cache.feed_set(feed_key, response)
                return response
        except Exception as e:
            logger.error(f"Personalized feed failed: {e}")

    # Fallback ordering logic
    if sort in ("latest", "promo"):
        items = query.order_by(models.Item.id.desc()).offset(skip).limit(limit).all()
    else:  # random or for_you (no wardrobe fallback) — seeded for consistent pagination
        db.execute(text(f"SELECT setseed({seed if seed is not None else 0.5})"))
        items = query.order_by(func.random()).offset(skip).limit(limit).all()

    response = [serialize_item(i) for i in items]
    cache.feed_set(feed_key, response)
    return response

@app.get("/items/{item_id}", response_model=schemas.Item)
def read_item(item_id: int, db: Session = Depends(get_db)):
    cached = cache.item_get(item_id)
    if cached is not None:
        return cached
    item = (
        db.query(models.Item)
        .options(defer(models.Item.embedding))
        .filter(models.Item.id == item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    result = serialize_item(item)
    cache.item_set(item_id, result)
    return result

@app.get("/api/items/{item_id}/image")
@app.get("/items/{item_id}/image")
def get_item_image_redirect(item_id: int, w: Optional[int] = None, db: Session = Depends(get_db)):
    """Redirects to the actual image URL for an item ID. Pass ?w=N to get a Cloudinary thumbnail."""
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item or not item.image_path:
        raise HTTPException(status_code=404, detail="Image not found")

    from fastapi.responses import RedirectResponse

    if item.image_path.startswith('http'):
        url = item.image_path
        if w and 'cloudinary.com' in url:
            url = url.replace('/upload/', f'/upload/w_{w},h_{w},c_fill,q_60/')
        elif w and storage.is_r2_url(url):
            url = storage.variant_url(url, w)
        return RedirectResponse(url=url)

    filename = os.path.basename(item.image_path)
    return RedirectResponse(url=f"/images/{filename}")

def _compute_and_store_embedding(item_id: int, image_bytes: bytes):
    # Runs after the response is sent. Opens its own DB session so the
    # request session is already closed and committed by the time this fires.
    db = SessionLocal()
    try:
        item = db.query(models.Item).filter(models.Item.id == item_id).first()
        if not item:
            return
        emb = search_engine.get_image_embedding_from_file(io.BytesIO(image_bytes))
        item.embedding = emb.tolist()
        db.commit()
        cache.feed_invalidate_all()
        cache.search_invalidate_all()
        logger.info(f"Embedding computed and stored for item {item_id}")
    except Exception as e:
        logger.error(f"Background embedding failed for item {item_id}: {e}", exc_info=True)
    finally:
        db.close()


@app.post("/upload", response_model=schemas.Item)
async def upload_item(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    price: float = Form(...),
    size: str = Form(...),
    market: str = Form(...),
    item_type: str = Form("top"),
    vendor_name: Optional[str] = Form(None),
    vendor_whatsapp: Optional[str] = Form(None),
    description: str = Form(None),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user:
        logger.warning("Unauthorized upload attempt")
        raise HTTPException(status_code=401, detail="Authentication required")

    if not current_user.is_vendor:
        logger.warning(f"User {current_user.id} is not a vendor, cannot upload")
        raise HTTPException(status_code=403, detail="Vendor account required")

    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="At least one image is required")

    if len(files) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 images allowed per item")

    name = validate_item_fields(name, description)

    if not current_user.vendor_id:
        if not vendor_whatsapp or not re.fullmatch(r"\+?\d{10,15}", vendor_whatsapp.replace(" ","").replace("-","").replace("(","").replace(")","")):
            raise HTTPException(status_code=400, detail="Invalid WhatsApp number format")

    logger.info(f"Uploading item '{name}' with {len(files)} images for vendor {current_user.vendor_id or 'new'}")

    # Read all file bytes upfront — UploadFile streams close after the request
    file_contents = []
    for f in files:
        if f.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
            raise HTTPException(status_code=400, detail=f"File {f.filename} is not a valid image type")
        file_contents.append(await f.read())

    uploaded_assets = []
    backup_public_ids = []

    try:
        # 1. Resolve vendor
        vendor = None
        if current_user.vendor_id:
            vendor = db.query(models.Vendor).filter(models.Vendor.id == current_user.vendor_id).first()
            if vendor and vendor_whatsapp:
                formatted_wa = format_whatsapp_number(vendor_whatsapp)
                vendor.whatsapp = formatted_wa
                db.add(vendor)
                db.commit()
                db.refresh(vendor)

        if not vendor:
            if not vendor_name:
                raise HTTPException(status_code=400, detail="Vendor name is required")
            vendor = db.query(models.Vendor).filter(models.Vendor.name == vendor_name).first()
            if not vendor:
                formatted_wa = format_whatsapp_number(vendor_whatsapp or "")
                vendor = models.Vendor(name=vendor_name, whatsapp=formatted_wa)
                db.add(vendor)
                db.commit()
                db.refresh(vendor)

        # 2. Guard against accidental double-upload (same name + price + size from same vendor)
        existing = db.query(models.Item).filter(
            models.Item.vendor_id == vendor.id,
            models.Item.name == name,
            models.Item.price == price,
            models.Item.size == size,
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"You already have an item called '{name}' with the same price and size (ID {existing.id}). If this is intentional, edit the name slightly to distinguish them."
            )

        # 3. Create item with a zero-vector placeholder embedding.
        # The real embedding is computed in the background after this response returns.
        embedding_dim = 512
        db_item = models.Item(
            name=name,
            price=price,
            size=size,
            market=market,
            item_type=item_type,
            description=description,
            vendor_id=vendor.id,
            embedding=[0.0] * embedding_dim
        )
        db.add(db_item)
        db.flush()

        # 4. Upload to both stores in parallel: R2 (primary — original + WebP
        # variants) and Cloudinary (best-effort fallback for users on ISPs that
        # block the R2 domain; cloudinary_backup never raises, a failed backup
        # leaves cloudinary_public_id NULL, which is backfillable).
        # return_exceptions=True on the R2 batch so a partial failure still
        # reports the successful uploads — they land in uploaded_assets and get
        # cleaned up on rollback, together with any Cloudinary backups.
        loop = asyncio.get_event_loop()

        upload_results, backup_ids = await asyncio.gather(
            asyncio.gather(
                *[loop.run_in_executor(None, storage.upload_image, content, "items")
                  for content in file_contents],
                return_exceptions=True
            ),
            asyncio.gather(
                *[loop.run_in_executor(None, cloudinary_backup, content, "thrifter_items", f"item '{name}'")
                  for content in file_contents]
            ),
        )
        for r in upload_results:
            if isinstance(r, str):
                uploaded_assets.append(r)
        backup_public_ids.extend(pid for pid in backup_ids if pid)
        for r in upload_results:
            if isinstance(r, BaseException):
                raise r

        for index, image_url in enumerate(upload_results):

            db.add(models.ItemImage(
                item_id=db_item.id,
                image_path=image_url,
                cloudinary_public_id=backup_ids[index],
                is_primary=(index == 0)
            ))

            if index == 0:
                db_item.image_path = image_url
                db_item.cloudinary_public_id = backup_ids[index]

        db.commit()
        db.refresh(db_item)
        logger.info(f"Item {db_item.id} created successfully with {len(files)} images")
        cache.feed_invalidate_all()
        cache.search_invalidate_all()
        cache.admin_stats_invalidate()

        # 5. Compute the real embedding in the background after the response is sent
        background_tasks.add_task(_compute_and_store_embedding, db_item.id, file_contents[0])

        return serialize_item(db_item)

    except Exception as e:
        db.rollback()
        for asset_url in uploaded_assets:
            storage.delete_image(asset_url)
        for public_id in backup_public_ids:
            try:
                cloudinary.uploader.destroy(public_id)
            except Exception:
                pass
        logger.error(f"Item upload failed: {str(e)}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Server error during upload: {str(e)}")

@app.get("/vendors", response_model=List[schemas.VendorInfo])
def list_vendors(db: Session = Depends(get_db)):
    vendors = db.query(models.Vendor).all()
    result = []
    for v in vendors:
        count = db.query(models.Item).filter(models.Item.vendor_id == v.id).count()
        result.append(schemas.VendorInfo(id=v.id, name=v.name, whatsapp=v.whatsapp, item_count=count))
    return result

@app.get("/vendors/{name}", response_model=schemas.VendorProfile)
def get_vendor(name: str, db: Session = Depends(get_db)):
    vendor = db.query(models.Vendor).filter(models.Vendor.name.ilike(name)).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    item_count = db.query(func.count(models.Item.id)).filter(
        models.Item.vendor_id == vendor.id
    ).scalar()
    return schemas.VendorProfile(
        id=vendor.id,
        name=vendor.name,
        item_count=item_count,
        banner_image=vendor.banner_image,
        banner_fallback_url=cloudinary_fallback_url(vendor.banner_cloudinary_id)
            if storage.is_r2_url(vendor.banner_image) else None,
        description=vendor.description,
        location=vendor.location,
    )

@app.put("/vendor/me", response_model=schemas.UserInfo)
def update_vendor_profile(
    body: schemas.VendorUpdate,
    current=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current or not current.is_vendor:
        raise HTTPException(status_code=403, detail="Vendor account required")
    vendor = db.query(models.Vendor).filter(models.Vendor.id == current.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    new_name = body.name.strip()
    if new_name.lower() != vendor.name.lower():
        taken = db.query(models.Vendor).filter(
            models.Vendor.name.ilike(new_name),
            models.Vendor.id != vendor.id
        ).first()
        if taken:
            raise HTTPException(status_code=400, detail="Store name already taken")

    formatted_whatsapp = format_whatsapp_number(body.whatsapp)
    if not formatted_whatsapp:
        raise HTTPException(status_code=400, detail="Invalid WhatsApp number")

    vendor.name = new_name
    vendor.whatsapp = formatted_whatsapp
    vendor.description = body.description
    vendor.location = body.location
    db.commit()
    db.refresh(vendor)

    cache.user_invalidate(current.id)
    cache.feed_invalidate_all()
    cache.search_invalidate_all()

    return schemas.UserInfo(
        id=current.id, email=current.email,
        is_vendor=current.is_vendor, is_admin=current.is_admin,
        vendor_name=vendor.name, vendor_whatsapp=vendor.whatsapp
    )

@app.post("/vendor/me/banner")
async def upload_vendor_banner(
    file: UploadFile = File(...),
    current=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current or not current.is_vendor:
        raise HTTPException(status_code=403, detail="Vendor account required")
    vendor = db.query(models.Vendor).filter(models.Vendor.id == current.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    content = await file.read()
    loop = asyncio.get_event_loop()
    new_banner_url = await loop.run_in_executor(None, storage.upload_image, content, "banners")

    # New banner is safely stored — now remove the old one from both stores
    # (a dual-written banner has an asset in each)
    if vendor.banner_cloudinary_id:
        try:
            cloudinary.uploader.destroy(vendor.banner_cloudinary_id)
        except Exception:
            pass
    if storage.is_r2_url(vendor.banner_image):
        storage.delete_image(vendor.banner_image)

    vendor.banner_image = new_banner_url
    vendor.banner_cloudinary_id = await loop.run_in_executor(
        None, cloudinary_backup, content, "thrifter_vendor_banners", f"banner for vendor {vendor.id}"
    )
    db.commit()

    return {
        "banner_image": vendor.banner_image,
        "banner_fallback_url": cloudinary_fallback_url(vendor.banner_cloudinary_id),
    }

@app.get("/search", response_model=List[schemas.Item])
@limiter.limit("30/minute")
def search_items(request: Request, query: str, db: Session = Depends(get_db)):
    logger.info(f"AI Search query: {query}")
    try:
        cached = cache.search_get(query)
        if cached is not None:
            return cached

        # 1. Get AI embedding for the text query
        query_emb = search_engine.get_text_embedding(query)

        # 2. Vector search using pgvector HNSW index (cosine distance).
        # No JOIN here — the join prevents the planner from using the HNSW index.
        # Vendor active-status filtering is done in Python after selectinload.
        raw_vector = (
            db.query(models.Item)
            .options(defer(models.Item.embedding), selectinload(models.Item.vendor))
            .filter(models.Item.embedding.isnot(None))
            .order_by(models.Item.embedding.cosine_distance(query_emb.tolist()))
            .limit(60)
            .all()
        )
        vector_results = [
            it for it in raw_vector
            if it.vendor_id is None or (it.vendor and it.vendor.is_active)
        ][:40]

        # 3. Keyword search (exact matches)
        keyword_results = (
            db.query(models.Item)
            .options(defer(models.Item.embedding))
            .outerjoin(models.Vendor, models.Item.vendor_id == models.Vendor.id)
            .filter(
                or_(models.Item.vendor_id == None, models.Vendor.is_active == True),
                or_(
                    models.Item.name.ilike(f"%{query}%"),
                    models.Item.description.ilike(f"%{query}%")
                )
            )
            .limit(20)
            .all()
        )

        # Combine results, prioritizing vector search but ensuring keywords are included
        seen_ids = set()
        combined = []

        for it in vector_results + keyword_results:
            if it.id not in seen_ids:
                combined.append(serialize_item(it))
                seen_ids.add(it.id)

        result = combined[:30]
        cache.search_set(query, result)
        logger.info(f"AI Search returned {len(result)} combined results")
        return result
    except Exception as e:
        logger.error(f"AI Search failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Search failed")

@app.post("/outfit-search")
async def outfit_search(file: UploadFile = File(...), db: Session = Depends(get_db)):
    logger.info(f"Image search request: {file.filename}")
    try:
        content = await file.read()

        def _embed():
            from PIL import Image as PILImage
            img = PILImage.open(io.BytesIO(content)).convert("RGB")
            img.thumbnail((512, 512), PILImage.LANCZOS)
            return search_engine.get_image_embedding_from_file(img)

        loop = asyncio.get_event_loop()
        input_emb = await loop.run_in_executor(None, _embed)

        items = (
            db.query(models.Item)
            .options(defer(models.Item.embedding), selectinload(models.Item.images), selectinload(models.Item.vendor))
            .filter(models.Item.embedding.isnot(None))
            .order_by(models.Item.embedding.cosine_distance(input_emb.tolist()))
            .limit(50)
            .all()
        )

        if not items:
            return []

        return [serialize_item(it) for it in items]
    except Exception as e:
        logger.error(f"Image search failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Image search failed")

@app.post("/outfit-builder")
async def outfit_builder(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Analyzes an inspiration image and suggests outfit combinations 
    from the current database items.
    """
    try:
        content = await file.read()
        input_emb = search_engine.get_image_embedding_from_file(io.BytesIO(content))
    except Exception as e:
        logger.error(f"Image processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Image processing failed: {e}")
    
    # Use pgvector to get top 50 candidates
    items = db.query(models.Item).order_by(
        models.Item.embedding.l2_distance(input_emb.tolist())
    ).limit(50).all()
    
    if not items:
        return {"outfits": []}
    
    groups = {"tops": [], "bottoms": [], "dresses": [], "accessories": []}
    
    for it in items:
        # Distance to score (rough conversion)
        dist = db.query(models.Item.embedding.l2_distance(input_emb.tolist())).filter(models.Item.id == it.id).scalar()
        score = max(0.1, 1.0 - (dist / 1.5))
        
        # Use structured item_type instead of keywords
        if it.item_type == "dress":
            groups["dresses"].append((score, it))
        elif it.item_type == "bottom":
            groups["bottoms"].append((score, it))
        elif it.item_type == "top":
            groups["tops"].append((score, it))
        elif it.item_type == "accessory":
            groups["accessories"].append((score, it))
        else:
            # Fallback for old items or unspecified types
            groups["tops"].append((score * 0.8, it))

    # Sort groups
    for k in groups:
        groups[k] = sorted(groups[k], key=lambda x: x[0], reverse=True)

    outfits = []
    
    # Create up to 3 combinations
    for i in range(min(3, len(groups["tops"]), len(groups["bottoms"]))):
        # Pick top and bottom that might go together
        _, t_it = groups["tops"][i]
        _, b_it = groups["bottoms"][i]
        
        outfits.append({
            "type": "combination",
            "top": serialize_item(t_it),
            "bottom": serialize_item(b_it),
            "score": (groups["tops"][i][0] + groups["bottoms"][i][0]) / 2
        })

    # 2. Add standalone Dresses as outfits
    for i in range(min(3, len(groups["dresses"]))):
        score, it = groups["dresses"][i]
        outfits.append({
            "type": "standalone",
            "item": serialize_item(it),
            "score": score
        })

    # If no outfits found, just return the top matches as standalone
    if not outfits and items:
        for i in range(min(3, len(items))):
            it = items[i]
            # Score calculation
            dist = db.query(models.Item.embedding.l2_distance(input_emb.tolist())).filter(models.Item.id == it.id).scalar()
            score = max(0.1, 1.0 - (dist / 1.5))
            outfits.append({
                "type": "standalone",
                "item": serialize_item(it),
                "score": score
            })
    
    # Sort final outfits by score and limit to top 3
    outfits = sorted(outfits, key=lambda x: x["score"], reverse=True)[:3]
    
    return {"outfits": outfits}

@app.delete("/items/{item_id}", status_code=204)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    if not current or not current.is_vendor:
        raise HTTPException(status_code=403, detail="Vendor account required")
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if current.vendor_id != item.vendor_id:
        raise HTTPException(status_code=403, detail="You can only delete your own items")
    # Delete ItemImage storage assets and rows first to avoid FK constraint error
    for img in (item.images or []):
        try:
            # Dual-written images have an asset in both stores — clean up each
            if img.cloudinary_public_id:
                cloudinary.uploader.destroy(img.cloudinary_public_id)
            if storage.is_r2_url(img.image_path):
                storage.delete_image(img.image_path)
        except Exception:
            pass
        db.delete(img)
    # Delete legacy asset
    try:
        if item.cloudinary_public_id:
            cloudinary.uploader.destroy(item.cloudinary_public_id)
        if storage.is_r2_url(item.image_path):
            storage.delete_image(item.image_path)
    except Exception as e:
        print(f"Image delete error: {e}")

    db.delete(item)
    db.commit()
    cache.feed_invalidate_all()
    cache.search_invalidate_all()
    cache.item_invalidate(item_id)
    cache.admin_stats_invalidate()
    return Response(status_code=204)

@app.put("/items/{item_id}", response_model=schemas.Item)
def update_item(
    item_id: int,
    name: str = Form(...),
    price: float = Form(...),
    size: str = Form(...),
    market: str = Form(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user)
):
    if not current or not current.is_vendor:
        raise HTTPException(status_code=403, detail="Vendor account required")
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if current.vendor_id != item.vendor_id:
        raise HTTPException(status_code=403, detail="You can only edit your own items")

    name = validate_item_fields(name, description)

    item.name = name
    item.price = price
    item.size = size
    item.market = market
    item.description = description
    
    db.commit()
    db.refresh(item)
    cache.feed_invalidate_all()
    cache.search_invalidate_all()
    cache.item_invalidate(item_id)
    return serialize_item(item)

@app.get("/wardrobe", response_model=List[schemas.Item])
def get_wardrobe(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current:
        raise HTTPException(status_code=401, detail="Unauthorized")
    rows = db.query(models.Wardrobe).filter(models.Wardrobe.user_id == current.id).order_by(models.Wardrobe.id.desc()).all()
    item_ids = [r.item_id for r in rows]
    if not item_ids:
        return []
    items = db.query(models.Item).options(
        defer(models.Item.embedding),
        selectinload(models.Item.images),
        selectinload(models.Item.vendor),
    ).filter(models.Item.id.in_(item_ids)).all()
    id_to_item = {i.id: i for i in items}
    return [serialize_item(id_to_item[iid]) for iid in item_ids if iid in id_to_item]

@app.post("/wardrobe/{item_id}", status_code=204)
def add_wardrobe(item_id: int, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current:
        raise HTTPException(status_code=401, detail="Unauthorized")
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    exists = db.query(models.Wardrobe).filter(models.Wardrobe.user_id == current.id, models.Wardrobe.item_id == item_id).first()
    if exists:
        return Response(status_code=204)
    row = models.Wardrobe(user_id=current.id, item_id=item_id)
    db.add(row)
    db.commit()
    cache.feed_invalidate_user(current.id)
    return Response(status_code=204)

@app.delete("/wardrobe/{item_id}", status_code=204)
def remove_wardrobe(item_id: int, current = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current:
        raise HTTPException(status_code=401, detail="Unauthorized")
    row = db.query(models.Wardrobe).filter(models.Wardrobe.user_id == current.id, models.Wardrobe.item_id == item_id).first()
    if not row:
        return Response(status_code=204)
    db.delete(row)
    db.commit()
    cache.feed_invalidate_user(current.id)
    return Response(status_code=204)

# ── Item view tracking ─────────────────────────────────────────────────────────

@app.get("/vendors/{name}/views")
def get_vendor_view_summary(name: str, current_user: Optional[models.User] = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    vendor = db.query(models.Vendor).filter(func.lower(models.Vendor.name) == name.lower()).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if not current_user.is_admin and current_user.vendor_id != vendor.id:
        raise HTTPException(status_code=403, detail="Access denied")

    item_ids = [row.id for row in db.query(models.Item.id).filter(models.Item.vendor_id == vendor.id).all()]
    if not item_ids:
        return {}

    now = datetime.utcnow()
    cutoff_7 = now - timedelta(days=7)
    cutoff_30 = now - timedelta(days=30)

    rows_7 = (
        db.query(models.ItemView.item_id, func.count(models.ItemView.id).label('cnt'))
        .filter(models.ItemView.item_id.in_(item_ids), models.ItemView.viewed_at >= cutoff_7)
        .group_by(models.ItemView.item_id).all()
    )
    rows_30 = (
        db.query(models.ItemView.item_id, func.count(models.ItemView.id).label('cnt'))
        .filter(models.ItemView.item_id.in_(item_ids), models.ItemView.viewed_at >= cutoff_30)
        .group_by(models.ItemView.item_id).all()
    )

    stats_7 = {row.item_id: row.cnt for row in rows_7}
    stats_30 = {row.item_id: row.cnt for row in rows_30}

    return {
        str(iid): {"last_7_days": stats_7.get(iid, 0), "last_30_days": stats_30.get(iid, 0)}
        for iid in item_ids
    }



@app.post("/items/{item_id}/view", status_code=204)
def record_item_view(item_id: int, current_user: Optional[models.User] = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if current_user:
        cutoff = datetime.utcnow() - timedelta(minutes=30)
        recent = db.query(models.ItemView).filter(
            models.ItemView.item_id == item_id,
            models.ItemView.user_id == current_user.id,
            models.ItemView.viewed_at >= cutoff,
        ).first()
        if recent:
            return Response(status_code=204)

    db.add(models.ItemView(item_id=item_id, user_id=current_user.id if current_user else None))
    db.commit()
    return Response(status_code=204)


@app.get("/items/{item_id}/views", response_model=schemas.ItemViewStats)
def get_item_view_stats(item_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Only the item's vendor or an admin can read view stats
    if not current_user.is_admin:
        if not current_user.vendor_id or current_user.vendor_id != item.vendor_id:
            raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.utcnow()
    cutoff_7 = now - timedelta(days=7)
    cutoff_30 = now - timedelta(days=30)

    base = db.query(models.ItemView).filter(models.ItemView.item_id == item_id)
    total = base.count()
    last_7 = base.filter(models.ItemView.viewed_at >= cutoff_7).count()
    last_30 = base.filter(models.ItemView.viewed_at >= cutoff_30).count()

    daily_rows = db.execute(
        text("""
            SELECT DATE(viewed_at) AS day, COUNT(*) AS cnt
            FROM item_views
            WHERE item_id = :item_id AND viewed_at >= :cutoff
            GROUP BY DATE(viewed_at)
            ORDER BY day DESC
        """),
        {"item_id": item_id, "cutoff": cutoff_30},
    ).fetchall()

    daily = [schemas.DailyViewCount(date=str(row.day), count=row.cnt) for row in daily_rows]

    return schemas.ItemViewStats(total=total, last_7_days=last_7, last_30_days=last_30, daily=daily)


# ── Admin endpoints ────────────────────────────────────────────────────────────

@app.get("/admin/stats", response_model=schemas.AdminStats)
def admin_stats(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    cached = cache.admin_stats_get()
    if cached is not None:
        return cached
    result = schemas.AdminStats(
        total_users=db.query(models.User).count(),
        total_vendors=db.query(models.Vendor).count(),
        total_items=db.query(models.Item).count(),
        total_wardrobe_saves=db.query(models.Wardrobe).count(),
        active_vendors=db.query(models.Vendor).filter(models.Vendor.is_active == True).count(),
        inactive_vendors=db.query(models.Vendor).filter(models.Vendor.is_active == False).count(),
    )
    cache.admin_stats_set(result)
    return result

@app.get("/admin/users", response_model=List[schemas.AdminUser])
def admin_list_users(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    users = db.query(models.User).order_by(models.User.id.desc()).all()
    result = []
    for u in users:
        vendor_name = None
        if u.vendor_id:
            v = db.query(models.Vendor).filter(models.Vendor.id == u.vendor_id).first()
            if v:
                vendor_name = v.name
        result.append(schemas.AdminUser(
            id=u.id, email=u.email, is_vendor=u.is_vendor,
            is_admin=u.is_admin, vendor_name=vendor_name
        ))
    return result

@app.get("/admin/vendors", response_model=List[schemas.AdminVendor])
def admin_list_vendors(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    vendors = (db.query(models.Vendor)
        .order_by(models.Vendor.is_pinned.desc(), models.Vendor.id.desc())
        .all())
    return [
        schemas.AdminVendor(
            id=v.id, name=v.name, whatsapp=v.whatsapp,
            is_active=v.is_active, is_pinned=v.is_pinned,
            item_count=db.query(models.Item).filter(models.Item.vendor_id == v.id).count()
        )
        for v in vendors
    ]

@app.get("/admin/items", response_model=List[schemas.AdminItem])
def admin_list_items(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    items = (
        db.query(models.Item)
        .options(
            defer(models.Item.embedding),
            selectinload(models.Item.images),
            selectinload(models.Item.vendor),
        )
        .order_by(models.Item.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    result = []
    for item in items:
        primary = next((img for img in item.images if img.is_primary), None) if item.images else None
        result.append(schemas.AdminItem(
            id=item.id, name=item.name, price=item.price, size=item.size,
            market=item.market,
            image_path=(primary.image_path if primary else item.image_path) or '',
            item_type=item.item_type,
            vendor_name=item.vendor.name if item.vendor else None
        ))
    return result

@app.patch("/admin/vendors/{vendor_id}/toggle", response_model=schemas.AdminVendor)
def admin_toggle_vendor(vendor_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.is_active = not vendor.is_active
    db.commit()
    db.refresh(vendor)
    cache.feed_invalidate_all()
    cache.search_invalidate_all()
    cache.admin_stats_invalidate()
    return schemas.AdminVendor(
        id=vendor.id, name=vendor.name, whatsapp=vendor.whatsapp,
        is_active=vendor.is_active, is_pinned=vendor.is_pinned,
        item_count=db.query(models.Item).filter(models.Item.vendor_id == v.id).count()
    )

@app.patch("/admin/vendors/{vendor_id}/pin", response_model=schemas.AdminVendor)
def admin_pin_vendor(vendor_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if not vendor.is_pinned:
        pinned_count = db.query(models.Vendor).filter(models.Vendor.is_pinned == True).count()
        if pinned_count >= 5:
            raise HTTPException(status_code=400, detail="Maximum of 5 vendors can be pinned")
    vendor.is_pinned = not vendor.is_pinned
    db.commit()
    db.refresh(vendor)
    return schemas.AdminVendor(
        id=vendor.id, name=vendor.name, whatsapp=vendor.whatsapp,
        is_active=vendor.is_active, is_pinned=vendor.is_pinned,
        item_count=db.query(models.Item).filter(models.Item.vendor_id == vendor.id).count()
    )

@app.patch("/admin/features/promo_10k")
def admin_toggle_promo(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    setting = db.query(models.AppSetting).filter(models.AppSetting.key == "promo_10k_enabled").first()
    if not setting:
        setting = models.AppSetting(key="promo_10k_enabled", value_bool=True)
        db.add(setting)
    else:
        setting.value_bool = not setting.value_bool
    db.commit()
    db.refresh(setting)
    return {"promo_10k_enabled": setting.value_bool}

@app.delete("/admin/items/{item_id}", status_code=204)
def admin_delete_item(item_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for img in (item.images or []):
        try:
            # Dual-written images have an asset in both stores — clean up each
            if img.cloudinary_public_id:
                cloudinary.uploader.destroy(img.cloudinary_public_id)
            if storage.is_r2_url(img.image_path):
                storage.delete_image(img.image_path)
        except Exception:
            pass
    try:
        if item.cloudinary_public_id:
            cloudinary.uploader.destroy(item.cloudinary_public_id)
        if storage.is_r2_url(item.image_path):
            storage.delete_image(item.image_path)
    except Exception:
        pass
    db.delete(item)
    db.commit()
    cache.feed_invalidate_all()
    cache.search_invalidate_all()
    cache.item_invalidate(item_id)
    cache.admin_stats_invalidate()
    return Response(status_code=204)

@app.get("/admin/visual-clusters", response_model=List[schemas.VisualCluster])
def admin_get_clusters(skip: int = 0, limit: int = 20, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    """Returns discovered visual clusters for the library, paginated."""
    return db.query(models.VisualCluster).order_by(models.VisualCluster.id.desc()).offset(skip).limit(limit).all()

@app.post("/admin/visual-clusters/create", response_model=schemas.VisualCluster)
def admin_create_manual_cluster(
    data: schemas.ManualClusterCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    """Creates a manual cluster by averaging the embeddings of the provided item IDs."""
    import numpy as np
    items = (
        db.query(models.Item)
        .filter(models.Item.id.in_(data.item_ids), models.Item.embedding.isnot(None))
        .all()
    )
    if not items:
        raise HTTPException(status_code=400, detail="None of the provided items have embeddings")

    centroid = np.mean([list(item.embedding) for item in items], axis=0).tolist()
    found_ids = [item.id for item in items]
    cluster = models.VisualCluster(
        ai_label=f"manual:{data.name}",
        custom_name=data.name,
        centroid_embedding=centroid,
        sample_item_ids=json.dumps(found_ids[:3])
    )
    db.add(cluster)
    db.commit()
    db.refresh(cluster)
    return cluster

@app.patch("/admin/visual-clusters/{cluster_id}", response_model=schemas.VisualCluster)
def admin_update_cluster(
    cluster_id: int,
    data: schemas.VisualClusterUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    """Updates a cluster's custom name."""
    vc = db.query(models.VisualCluster).filter(models.VisualCluster.id == cluster_id).first()
    if not vc:
        raise HTTPException(status_code=404, detail="Cluster not found")

    vc.custom_name = data.custom_name
    db.commit()
    db.refresh(vc)
    return vc

@app.get("/admin/visual-clusters/{cluster_id}/items", response_model=List[schemas.Item])
def admin_get_cluster_items(cluster_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    """Returns all items matching a cluster's DNA (for the horizontal preview)."""
    vc = db.query(models.VisualCluster).filter(models.VisualCluster.id == cluster_id).first()
    if not vc or vc.centroid_embedding is None:
        raise HTTPException(status_code=404, detail="Cluster not found")
        
    centroid_str = "[" + ",".join(str(x) for x in vc.centroid_embedding) + "]"
    items = (
        db.query(models.Item)
        .options(defer(models.Item.embedding), selectinload(models.Item.images), selectinload(models.Item.vendor))
        .filter(models.Item.embedding.isnot(None))
        .order_by(text(f"embedding <=> '{centroid_str}'::vector"))
        .limit(8)
        .all()
    )
    return [serialize_item(i) for i in items]

@app.get("/admin/outfit-styles", response_model=List[schemas.StyleCategory])
def admin_get_styles(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    """Returns all style aesthetics for management."""
    return db.query(models.StyleCategory).order_by(models.StyleCategory.is_approved.asc(), models.StyleCategory.id.desc()).all()

@app.post("/admin/outfit-styles/create", response_model=schemas.StyleCategory)
def admin_create_style(
    data: schemas.StyleCategoryBase, 
    db: Session = Depends(get_db), 
    _: models.User = Depends(require_admin)
):
    """Creates a new curated style aesthetic."""
    new_style = models.StyleCategory(
        name=data.name,
        slug=data.slug,
        description=data.description,
        is_approved=True,
        sample_item_ids=data.sample_item_ids,
        cover_image_path=data.cover_image_path,
        cover_cloudinary_id=data.cover_cloudinary_id,
        top_cluster_id=data.top_cluster_id,
        bottom_cluster_id=data.bottom_cluster_id,
        accessory_cluster_id=data.accessory_cluster_id
    )
    db.add(new_style)
    db.commit()
    db.refresh(new_style)
    return new_style

@app.post("/admin/outfit-styles/{style_id}/approve", response_model=schemas.StyleCategory)
def approve_style(
    style_id: int, 
    data: schemas.StyleCategoryBase, 
    db: Session = Depends(get_db), 
    _: models.User = Depends(require_admin)
):
    style = db.query(models.StyleCategory).filter(models.StyleCategory.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    
    style.name = data.name
    style.slug = data.slug
    style.description = data.description
    style.is_approved = True
    style.sample_item_ids = data.sample_item_ids
    style.cover_image_path = data.cover_image_path
    style.cover_cloudinary_id = data.cover_cloudinary_id
    style.top_cluster_id = data.top_cluster_id
    style.bottom_cluster_id = data.bottom_cluster_id
    style.accessory_cluster_id = data.accessory_cluster_id
    
    db.commit()
    db.refresh(style)
    return style

@app.post("/admin/outfit-styles/upload-cover")
async def upload_style_cover(
    file: UploadFile = File(...),
    _: models.User = Depends(require_admin)
):
    """Uploads an image to R2 (with a Cloudinary backup) for use as a style aesthetic cover."""
    try:
        content = await file.read()
        loop = asyncio.get_event_loop()
        image_url = await loop.run_in_executor(None, storage.upload_image, content, "styles")
        public_id = await loop.run_in_executor(
            None, cloudinary_backup, content, "thrifter_styles", "style cover"
        )
        return {
            "image_path": image_url,
            "cloudinary_public_id": public_id
        }
    except Exception as e:
        logger.error(f"Style cover upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/admin/outfit-styles/{style_id}", status_code=204)
def admin_delete_style(style_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    """Deletes a curated style aesthetic."""
    style = db.query(models.StyleCategory).filter(models.StyleCategory.id == style_id).first()
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    db.delete(style)
    db.commit()
    return Response(status_code=204)

@app.post("/admin/outfit-styles/discover")
def trigger_style_discovery(background_tasks: BackgroundTasks, _: models.User = Depends(require_admin)):
    """Triggers the style discovery background task manually."""
    background_tasks.add_task(_run_style_discovery_task)
    return {"message": "Style discovery started in background"}


# ─── Demand Board ─────────────────────────────────────────────────────────────

@app.post("/demand", status_code=201)
def create_demand_entry(
    entry: schemas.DemandEntryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Login required to submit a demand entry")
    new_entry = models.DemandEntry(
        user_id=current_user.id,
        item_name=entry.item_name,
        price=entry.price,
        description=entry.description,
    )
    db.add(new_entry)
    db.commit()
    return {"message": "Entry submitted and pending approval"}


@app.get("/demand")
def list_demand_entries(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    base = cache.demand_get()

    if base is None:
        expiry_cutoff = datetime.utcnow() - timedelta(weeks=3)

        vote_agg = (
            db.query(
                models.DemandVote.entry_id.label("entry_id"),
                func.sum(case((models.DemandVote.vote_type == "up", 1), else_=0)).label("upvotes"),
                func.sum(case((models.DemandVote.vote_type == "down", 1), else_=0)).label("downvotes"),
            )
            .group_by(models.DemandVote.entry_id)
            .subquery()
        )

        rows = (
            db.query(
                models.DemandEntry,
                func.coalesce(vote_agg.c.upvotes, 0).label("upvotes"),
                func.coalesce(vote_agg.c.downvotes, 0).label("downvotes"),
            )
            .outerjoin(vote_agg, models.DemandEntry.id == vote_agg.c.entry_id)
            .filter(
                models.DemandEntry.status == "approved",
                models.DemandEntry.last_interacted_at > expiry_cutoff,
            )
            .order_by(
                (func.coalesce(vote_agg.c.upvotes, 0) - func.coalesce(vote_agg.c.downvotes, 0)).desc()
            )
            .all()
        )

        base = [
            {
                "id": entry.id,
                "item_name": entry.item_name,
                "price": entry.price,
                "description": entry.description,
                "status": entry.status,
                "created_at": entry.created_at,
                "upvotes": int(upvotes),
                "downvotes": int(downvotes),
                "score": int(upvotes) - int(downvotes),
            }
            for entry, upvotes, downvotes in rows
        ]
        cache.demand_set(base)

    if not current_user:
        return [{**r, "user_vote": None} for r in base]

    entry_ids = [r["id"] for r in base]
    user_votes = {
        v.entry_id: v.vote_type
        for v in db.query(models.DemandVote).filter(
            models.DemandVote.user_id == current_user.id,
            models.DemandVote.entry_id.in_(entry_ids),
        ).all()
    } if entry_ids else {}

    return [{**r, "user_vote": user_votes.get(r["id"])} for r in base]


@app.post("/demand/{entry_id}/vote")
def vote_demand_entry(
    entry_id: int,
    vote: schemas.DemandVoteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Login required to vote")
    entry = db.query(models.DemandEntry).filter(
        models.DemandEntry.id == entry_id,
        models.DemandEntry.status == "approved"
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    existing = db.query(models.DemandVote).filter_by(
        user_id=current_user.id, entry_id=entry_id
    ).first()
    if existing:
        if existing.vote_type == vote.vote_type:
            db.delete(existing)
        else:
            existing.vote_type = vote.vote_type
    else:
        db.add(models.DemandVote(
            user_id=current_user.id,
            entry_id=entry_id,
            vote_type=vote.vote_type
        ))
    entry.last_interacted_at = datetime.utcnow()
    db.commit()
    return {"message": "Vote recorded"}


@app.delete("/demand/{entry_id}/vote")
def remove_demand_vote(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Login required")
    existing = db.query(models.DemandVote).filter_by(
        user_id=current_user.id, entry_id=entry_id
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="No vote found")
    db.delete(existing)
    db.commit()
    return {"message": "Vote removed"}


@app.get("/admin/demand/pending")
def admin_demand_pending(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    entries = (
        db.query(models.DemandEntry)
        .options(joinedload(models.DemandEntry.user))
        .filter(models.DemandEntry.status == "pending")
        .order_by(models.DemandEntry.created_at.asc())
        .all()
    )
    return [
        schemas.DemandEntryAdminResponse(
            id=e.id,
            item_name=e.item_name,
            price=e.price,
            description=e.description,
            created_at=e.created_at,
            submitter_email=e.user.email if e.user else None,
        )
        for e in entries
    ]


@app.patch("/admin/demand/{entry_id}")
def admin_edit_demand_entry(
    entry_id: int,
    update: schemas.DemandEntryUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    entry = db.query(models.DemandEntry).filter(models.DemandEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if update.item_name is not None:
        entry.item_name = update.item_name
    if update.price is not None:
        entry.price = update.price
    if update.description is not None:
        entry.description = update.description
    db.commit()
    cache.demand_invalidate()
    return {"message": "Entry updated"}


@app.delete("/admin/demand/{entry_id}")
def admin_delete_demand_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    entry = db.query(models.DemandEntry).filter(models.DemandEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    cache.demand_invalidate()
    return {"message": "Entry deleted"}


@app.patch("/admin/demand/{entry_id}/status")
def admin_update_demand_status(
    entry_id: int,
    update: schemas.DemandStatusUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin)
):
    entry = db.query(models.DemandEntry).filter(models.DemandEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.status = update.status
    if update.status == "approved":
        entry.last_interacted_at = datetime.utcnow()
    db.commit()
    cache.demand_invalidate()
    return {"message": f"Entry {update.status}"}
