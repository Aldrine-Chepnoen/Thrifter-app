# This is the main application file for the Thrifter backend API. It sets up the FastAPI application, configures database connections, defines API endpoints for user authentication, item management, and search functionality. The application uses SQLAlchemy for database interactions, Cloudinary for image storage, and a custom search engine for generating image embeddings and performing similarity searches. The code also includes structured logging, error handling, and rate limiting to ensure a robust and secure API. Additionally, there are utility functions for password hashing, JWT token management, and seeding demo data for testing purposes. 
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Header, Response, Request
from fastapi.responses import JSONResponse
import logging
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
import shutil
import os
import uuid
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
        content={"detail": "Validation Error", "errors": exc.errors()}
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

def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> Optional[models.User]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = parse_token(token, db)
    user = db.query(models.User).filter(models.User.id == payload.get("uid")).first()
    return user

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
def me(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current:
        raise HTTPException(status_code=401, detail="Unauthorized")
    vendor_name = None
    vendor_whatsapp = None
    if current.vendor_id:
        v = db.query(models.Vendor).filter(models.Vendor.id == current.vendor_id).first()
        if v:
            vendor_name = v.name
            vendor_whatsapp = v.whatsapp
    return schemas.UserInfo(id=current.id, email=current.email, is_vendor=current.is_vendor, vendor_name=vendor_name, vendor_whatsapp=vendor_whatsapp)

def serialize_item(item: models.Item) -> schemas.Item:
    vendor_name = item.vendor.name if item.vendor else None
    vendor_whatsapp = item.vendor.whatsapp if item.vendor else None
    return schemas.Item(
        id=item.id,
        name=item.name,
        price=item.price,
        size=item.size,
        market=item.market,
        description=item.description,
        image_path=item.image_path,
        vendor_name=vendor_name,
        vendor_whatsapp=vendor_whatsapp,
        whatsapp=vendor_whatsapp or None
    )

@app.get("/items", response_model=List[schemas.Item])
def read_items(
    skip: int = 0,
    limit: int = 100,
    vendor: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.Item)
    if vendor:
        q = q.join(models.Vendor).filter(models.Vendor.name.ilike(f"%{vendor}%"))
    items = q.offset(skip).limit(limit).all()
    return [serialize_item(i) for i in items]

@app.post("/upload", response_model=schemas.Item)
async def upload_item(
    name: str = Form(...),
    price: float = Form(...),
    size: str = Form(...),
    market: str = Form(...),
    vendor_name: Optional[str] = Form(None),
    vendor_whatsapp: Optional[str] = Form(None),
    description: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user:
        logger.warning("Unauthorized upload attempt")
        raise HTTPException(status_code=401, detail="Authentication required")

    if not current_user.is_vendor:
        logger.warning(f"User {current_user.id} is not a vendor, cannot upload")
        raise HTTPException(status_code=403, detail="Vendor account required")

    # Validation: content type and size
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG and WebP images are allowed")
    content = await file.read()
    max_size = 10 * 1024 * 1024 # 10MB
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="Image exceeds 10MB limit")

    if not current_user.vendor_id:
        if not vendor_whatsapp or not re.fullmatch(r"\+?\d{10,15}", vendor_whatsapp.replace(" ","").replace("-","").replace("(","").replace(")","")):
            raise HTTPException(status_code=400, detail="Invalid WhatsApp number format")

    logger.info(f"Uploading item '{name}' for vendor {current_user.vendor_id or 'new'}")

    try:
        # 1. Generate Embedding FIRST (to fail early if AI model dies)
        file.file.seek(0)
        emb = search_engine.get_image_embedding_from_file(file.file)
        
        # 2. Upload to Cloudinary with optimization
        file.file.seek(0)
        upload_result = cloudinary.uploader.upload(
            file.file,
            folder="thrifter_items",
            transformation=[
                {"width": 1000, "crop": "limit"}, # Resize if too large
                {"quality": "auto"},              # Auto compression
                {"fetch_format": "auto"}          # Auto WebP/AVIF
            ]
        )
        image_url = upload_result.get("secure_url")
        public_id = upload_result.get("public_id")
        
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

        # 3. Create DB Record with Vector
        db_item = models.Item(
            name=name,
            price=price,
            size=size,
            market=market,
            description=description,
            image_path=image_url,
            cloudinary_public_id=public_id,
            vendor_id=vendor.id,
            embedding=emb.tolist() # pgvector accepts list or np.array
        )
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        
        logger.info(f"Item created successfully: {db_item.id}")
        return serialize_item(db_item)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Item upload failed: {str(e)}", exc_info=True)
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
    logger.info(f"Search query: {query}")
    try:
        results = db.query(models.Item).filter(
            or_(
                models.Item.name.ilike(f"%{query}%"),
                models.Item.description.ilike(f"%{query}%"),
                models.Item.market.ilike(f"%{query}%"),
                models.Item.size.ilike(f"%{query}%")
            )
        ).limit(20).all()
        logger.info(f"Search returned {len(results)} results")
        return [serialize_item(i) for i in results]
    except Exception as e:
        logger.error(f"Search failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Search failed")

@app.post("/outfit-search")
async def outfit_search(file: UploadFile = File(...), db: Session = Depends(get_db)):
    logger.info(f"Image search request: {file.filename}")
    try:
        input_emb = search_engine.get_image_embedding_from_file(file.file)
        
        # Use pgvector for L2 distance search (closest 50 items for grouping)
        items = db.query(models.Item).order_by(
            models.Item.embedding.l2_distance(input_emb.tolist())
        ).limit(50).all()

        if not items:
            return {"tops": [], "bottoms": [], "dresses": [], "order": ["tops","bottoms","dresses"]}
        
        tops_kw = r"(top|shirt|t-?shirt|blouse|sweater|hoodie|jacket|coat|cardigan|jersey|vest)"
        bottoms_kw = r"(jeans|pants|trousers|skirt|shorts|leggings|joggers|sweatpants)"
        dresses_kw = r"(dress|gown|jumpsuit|romper)"
        groups = {"tops": [], "bottoms": [], "dresses": []}
        
        for it in items:
            dist = db.query(models.Item.embedding.l2_distance(input_emb.tolist())).filter(models.Item.id == it.id).scalar()
            score = max(0.1, 1.0 - (dist / 1.5))
            
            text = f"{it.name or ''} {it.description or ''}".lower()
            if re.search(dresses_kw, text):
                groups["dresses"].append(serialize_item(it))
            elif re.search(bottoms_kw, text):
                groups["bottoms"].append(serialize_item(it))
            elif re.search(tops_kw, text):
                groups["tops"].append(serialize_item(it))
            else:
                groups["tops"].append(serialize_item(it))

        return {
            "tops": groups["tops"][:10],
            "bottoms": groups["bottoms"][:10],
            "dresses": groups["dresses"][:10],
            "order": ["tops", "bottoms", "dresses"]
        }
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
        input_emb = search_engine.get_image_embedding_from_file(file.file)
    except Exception as e:
        logger.error(f"Image processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Image processing failed: {e}")
    
    # Use pgvector to get top 50 candidates
    items = db.query(models.Item).order_by(
        models.Item.embedding.l2_distance(input_emb.tolist())
    ).limit(50).all()
    
    if not items:
        return {"outfits": []}
    
    # Grouping logic
    tops_kw = r"(top|shirt|t-?shirt|blouse|sweater|hoodie|jacket|coat|cardigan|jersey|vest)"
    bottoms_kw = r"(jeans|pants|trousers|skirt|shorts|leggings|joggers|sweatpants)"
    dresses_kw = r"(dress|gown|jumpsuit|romper)"
    
    groups = {"tops": [], "bottoms": [], "dresses": []}
    
    for it in items:
        # Distance to score (rough conversion)
        dist = db.query(models.Item.embedding.l2_distance(input_emb.tolist())).filter(models.Item.id == it.id).scalar()
        score = max(0.1, 1.0 - (dist / 1.5))
        
        text = f"{it.name or ''} {it.description or ''}".lower()
        
        if re.search(dresses_kw, text):
            groups["dresses"].append((score, it))
        elif re.search(bottoms_kw, text):
            groups["bottoms"].append((score, it))
        elif re.search(tops_kw, text):
            groups["tops"].append((score, it))
        else:
            groups["tops"].append((score * 0.8, it))

    # Sort groups
    for k in groups:
        groups[k] = sorted(groups[k], key=lambda x: x[0], reverse=True)

    outfits = []
    
    # Create up to 10 combinations
    for i in range(min(10, len(groups["tops"]), len(groups["bottoms"]))):
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
    for i in range(min(5, len(groups["dresses"]))):
        score, it = groups["dresses"][i]
        outfits.append({
            "type": "standalone",
            "item": serialize_item(it),
            "score": score
        })

    # If no outfits found, just return the top matches as standalone
    if not outfits and items:
        for i in range(min(10, len(items))):
            it = items[i]
            # Score calculation
            dist = db.query(models.Item.embedding.l2_distance(input_emb.tolist())).filter(models.Item.id == it.id).scalar()
            score = max(0.1, 1.0 - (dist / 1.5))
            outfits.append({
                "type": "standalone",
                "item": serialize_item(it),
                "score": score
            })
    
    # Sort final outfits by score
    outfits = sorted(outfits, key=lambda x: x["score"], reverse=True)
    
    return {"outfits": outfits}

@app.post("/outfit-search")
async def outfit_search(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        input_emb = search_engine.get_image_embedding_from_file(file.file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing failed: {e}")
    
    # Use pgvector to get top 50 candidates
    items = db.query(models.Item).order_by(
        models.Item.embedding.l2_distance(input_emb.tolist())
    ).limit(50).all()

    if not items:
        return {"tops": [], "bottoms": [], "dresses": [], "order": ["tops","bottoms","dresses"]}
    
    tops_kw = r"(top|shirt|t-?shirt|blouse|sweater|hoodie|jacket|coat|cardigan|jersey|vest)"
    bottoms_kw = r"(jeans|pants|trousers|skirt|shorts|leggings|joggers|sweatpants)"
    dresses_kw = r"(dress|gown|jumpsuit|romper)"
    groups = {"tops": [], "bottoms": [], "dresses": []}
    
    for it in items:
        dist = db.query(models.Item.embedding.l2_distance(input_emb.tolist())).filter(models.Item.id == it.id).scalar()
        score = max(0.1, 1.0 - (dist / 1.5))
        
        text = f"{it.name or ''} {it.description or ''}".lower()
        if re.search(dresses_kw, text):
            groups["dresses"].append((score, it))
        elif re.search(bottoms_kw, text):
            groups["bottoms"].append((score, it))
        elif re.search(tops_kw, text):
            groups["tops"].append((score, it))
        else:
            groups["tops"].append((score * 0.9, it))
    result = {}
    for k in groups:
        sorted_group = sorted(groups[k], key=lambda x: x[0], reverse=True)[:10]
        result[k] = [serialize_item(it) for _, it in sorted_group]
    primary = "tops"
    try:
        cats = ["dress","jeans","trousers","skirt","shorts","shirt","tshirt","blouse","sweater","hoodie","jacket","coat","cardigan"]
        if getattr(search_engine, "model", None) is not None:
            txt = [search_engine.get_text_embedding(f"a photo of a {c}") for c in cats]
            mat = np.stack(txt)
            sims = cosine_similarity(input_emb.reshape(1, -1), mat)[0]
            best = cats[int(sims.argmax())]
            if best == "dress":
                primary = "dresses"
            elif best in ("jeans","trousers","skirt","shorts"):
                primary = "bottoms"
            else:
                primary = "tops"
        else:
            if len(result.get("dresses", [])) > 0:
                primary = "dresses"
            elif len(result.get("bottoms", [])) > 0 and len(result.get("tops", [])) == 0:
                primary = "bottoms"
            else:
                primary = "tops"
    except Exception:
        primary = "tops"
    order = [primary] + [k for k in ["tops","bottoms","dresses"] if k != primary]
    result["order"] = order
    return result

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
    # Delete from Cloudinary
    try:
        if item.cloudinary_public_id:
            cloudinary.uploader.destroy(item.cloudinary_public_id)
    except Exception as e:
        print(f"Cloudinary delete error: {e}")
    
    # Delete record
    db.delete(item)
    db.commit()
    return Response(status_code=204)

@app.get("/wardrobe", response_model=List[schemas.Item])
def get_wardrobe(current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current:
        raise HTTPException(status_code=401, detail="Unauthorized")
    rows = db.query(models.Wardrobe).filter(models.Wardrobe.user_id == current.id).all()
    item_ids = [r.item_id for r in rows]
    if not item_ids:
        return []
    items = db.query(models.Item).filter(models.Item.id.in_(item_ids)).all()
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
    return Response(status_code=204)

@app.delete("/wardrobe/{item_id}", status_code=204)
def remove_wardrobe(item_id: int, current: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current:
        raise HTTPException(status_code=401, detail="Unauthorized")
    row = db.query(models.Wardrobe).filter(models.Wardrobe.user_id == current.id, models.Wardrobe.item_id == item_id).first()
    if not row:
        return Response(status_code=204)
    db.delete(row)
    db.commit()
    return Response(status_code=204)
