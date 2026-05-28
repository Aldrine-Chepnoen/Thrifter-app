# This is the main application file for the Thrifter backend API. It sets up the FastAPI application, configures database connections, defines API endpoints for user authentication, item management, and search functionality. The application uses SQLAlchemy for database interactions, Cloudinary for image storage, and a custom search engine for generating image embeddings and performing similarity searches. The code also includes structured logging, error handling, and rate limiting to ensure a robust and secure API. Additionally, there are utility functions for password hashing, JWT token management, and seeding demo data for testing purposes. 
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Header, Response, Request
from fastapi.responses import JSONResponse
import logging
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, defer
from sqlalchemy import or_, func
import shutil
import os
import uuid
import io
from typing import List, Optional
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import json
import re
from PIL import Image, ImageDraw
from sqlalchemy import text

from database import get_db, engine, Base
import models
import schemas
import search_engine
import cache

# Create tables
models.Base.metadata.create_all(bind=engine)

import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url

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
        "outfit_builder": settings.FEATURE_OUTFIT_BUILDER_ENABLED,
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

@app.on_event("startup")
def startup_event():
    db = next(get_db())
    if SEED_DEMO:
        logger.info("Seeding demo data...")
        seed_demo_data(db)

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
                is_primary=img.is_primary
            ) for img in item.images
        ]

    primary_image = next((img for img in images if img.is_primary), None)
    if not primary_image and images:
        primary_image = images[0]

    display_image_path = primary_image.image_path if primary_image else item.image_path
    display_cloudinary_id = primary_image.cloudinary_public_id if primary_image else item.cloudinary_public_id

    return schemas.Item(
        id=item.id,
        name=item.name,
        price=item.price,
        size=item.size,
        market=item.market,
        item_type=item.item_type or "top",
        description=item.description,
        image_path=display_image_path,
        cloudinary_public_id=display_cloudinary_id,
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

    # 6. Fetch random discovery items
    db.execute(text(f"SELECT setseed({seed})"))
    random_items = (
        base_query
        .filter(~models.Item.id.in_(exclude_ids))
        .order_by(func.random())
        .offset(skip)
        .limit(random_count)
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
    query = db.query(models.Item).options(defer(models.Item.embedding))

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

    # Personalized Recommendation Logic
    if sort == "random" and current_user:
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
    else:
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

@app.post("/upload", response_model=schemas.Item)
async def upload_item(
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

    if not current_user.vendor_id:
        if not vendor_whatsapp or not re.fullmatch(r"\+?\d{10,15}", vendor_whatsapp.replace(" ","").replace("-","").replace("(","").replace(")","")):
            raise HTTPException(status_code=400, detail="Invalid WhatsApp number format")

    logger.info(f"Uploading item '{name}' with {len(files)} images for vendor {current_user.vendor_id or 'new'}")

    uploaded_assets = []

    try:
        # 1. Process the primary image for embedding
        primary_file = files[0]
        if primary_file.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
            raise HTTPException(status_code=400, detail=f"File {primary_file.filename} is not a valid image type")

        content = await primary_file.read()
        image_stream = io.BytesIO(content)
        emb = search_engine.get_image_embedding_from_file(image_stream)

        # 2. Resolve vendor
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

        # 3. Guard against accidental double-upload (same name + price + size from same vendor)
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

        # 4. Create item record (image columns filled after upload)
        db_item = models.Item(
            name=name,
            price=price,
            size=size,
            market=market,
            item_type=item_type,
            description=description,
            vendor_id=vendor.id,
            embedding=emb.tolist()
        )
        db.add(db_item)
        db.flush()

        # 4. Upload each image to Cloudinary and create ItemImage records
        for index, f in enumerate(files):
            if index == 0:
                image_stream.seek(0)
            else:
                if f.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
                    raise HTTPException(status_code=400, detail=f"File {f.filename} is not a valid image type")
                content = await f.read()
                image_stream = io.BytesIO(content)

            upload_result = cloudinary.uploader.upload(
                image_stream,
                folder="thrifter_items",
                transformation=[
                    {"width": 1000, "crop": "limit"},
                    {"quality": "auto"},
                    {"fetch_format": "auto"}
                ]
            )
            public_id = upload_result.get("public_id")
            uploaded_assets.append(public_id)
            image_url = upload_result.get("secure_url")

            db.add(models.ItemImage(
                item_id=db_item.id,
                image_path=image_url,
                cloudinary_public_id=public_id,
                is_primary=(index == 0)
            ))

            if index == 0:
                db_item.image_path = image_url
                db_item.cloudinary_public_id = public_id

        db.commit()
        db.refresh(db_item)
        logger.info(f"Item {db_item.id} created successfully with {len(files)} images")
        cache.feed_invalidate_all()
        cache.admin_stats_invalidate()
        return serialize_item(db_item)

    except Exception as e:
        db.rollback()
        for asset_id in uploaded_assets:
            try:
                cloudinary.uploader.destroy(asset_id)
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

@app.get("/search", response_model=List[schemas.Item])
@limiter.limit("30/minute")
def search_items(request: Request, query: str, db: Session = Depends(get_db)):
    logger.info(f"AI Search query: {query}")
    try:
        # 1. Get AI embedding for the text query
        query_emb = search_engine.get_text_embedding(query)
        
        # 2. Vector search using pgvector (semantic/visual similarity)
        # We find top 40 similar items
        vector_results = (
            db.query(models.Item)
            .outerjoin(models.Vendor, models.Item.vendor_id == models.Vendor.id)
            .filter(or_(models.Item.vendor_id == None, models.Vendor.is_active == True))
            .order_by(models.Item.embedding.l2_distance(query_emb.tolist()))
            .limit(40)
            .all()
        )

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
                
        logger.info(f"AI Search returned {len(combined)} combined results")
        return combined[:30]
    except Exception as e:
        logger.error(f"AI Search failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Search failed")

@app.post("/outfit-search")
async def outfit_search(file: UploadFile = File(...), db: Session = Depends(get_db)):
    logger.info(f"Image search request: {file.filename}")
    try:
        content = await file.read()
        image_stream = io.BytesIO(content)
        input_emb = search_engine.get_image_embedding_from_file(image_stream)
        
        # Use pgvector for L2 distance search (closest 50 items)
        items = db.query(models.Item).order_by(
            models.Item.embedding.l2_distance(input_emb.tolist())
        ).limit(50).all()

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
    # Delete ItemImage Cloudinary assets and rows first to avoid FK constraint error
    for img in (item.images or []):
        try:
            if img.cloudinary_public_id:
                cloudinary.uploader.destroy(img.cloudinary_public_id)
        except Exception:
            pass
        db.delete(img)
    # Delete legacy Cloudinary asset
    try:
        if item.cloudinary_public_id:
            cloudinary.uploader.destroy(item.cloudinary_public_id)
    except Exception as e:
        print(f"Cloudinary delete error: {e}")

    db.delete(item)
    db.commit()
    cache.feed_invalidate_all()
    cache.item_invalidate(item_id)
    cache.admin_stats_invalidate()
    return Response(status_code=204)

@app.put("/items/{item_id}", response_model=schemas.Item)
def update_item(
    item_id: int,
    name: str = Form(...),
    price: float = Form(...),
    size: str = Form(...),
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
    
    item.name = name
    item.price = price
    item.size = size
    item.description = description
    
    db.commit()
    db.refresh(item)
    cache.feed_invalidate_all()
    cache.item_invalidate(item_id)
    return serialize_item(item)

@app.get("/wardrobe", response_model=List[schemas.Item])
def get_wardrobe(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current:
        raise HTTPException(status_code=401, detail="Unauthorized")
    rows = db.query(models.Wardrobe).filter(models.Wardrobe.user_id == current.id).all()
    item_ids = [r.item_id for r in rows]
    if not item_ids:
        return []
    items = db.query(models.Item).options(defer(models.Item.embedding)).filter(models.Item.id.in_(item_ids)).all()
    return [serialize_item(i) for i in items]

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
def admin_list_items(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    items = db.query(models.Item).options(defer(models.Item.embedding)).order_by(models.Item.id.desc()).all()
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
    cache.admin_stats_invalidate()
    return schemas.AdminVendor(
        id=vendor.id, name=vendor.name, whatsapp=vendor.whatsapp,
        is_active=vendor.is_active, is_pinned=vendor.is_pinned,
        item_count=db.query(models.Item).filter(models.Item.vendor_id == vendor.id).count()
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
        if img.cloudinary_public_id:
            try:
                cloudinary.uploader.destroy(img.cloudinary_public_id)
            except Exception:
                pass
    if item.cloudinary_public_id:
        try:
            cloudinary.uploader.destroy(item.cloudinary_public_id)
        except Exception:
            pass
    db.delete(item)
    db.commit()
    cache.feed_invalidate_all()
    cache.item_invalidate(item_id)
    cache.admin_stats_invalidate()
    return Response(status_code=204)
