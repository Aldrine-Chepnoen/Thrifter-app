# This file defines the Pydantic schemas for the Thrifter backend application. These schemas are used for data validation and serialization when handling API requests and responses. The UserCreate schema is used for user registration, ensuring that the email, password, and optional vendor information are properly validated. The Token schema defines the structure of the JWT token response after successful authentication. The UserInfo schema represents the user information that can be returned in API responses, while the ItemBase, ItemCreate, and Item schemas define the structure of item data for creation and retrieval. Finally, the VendorInfo schema provides a structure for representing vendor information in API responses. These schemas help ensure that data is consistently structured and validated across the application.
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
import re

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    is_vendor: bool = False
    vendor_name: Optional[str] = Field(None, min_length=2)
    vendor_whatsapp: Optional[str] = None

    @validator('vendor_whatsapp')
    def validate_whatsapp(cls, v):
        if not v:
            return v
        # Simple cleanup for common characters
        cleaned = v.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        # Basic check to ensure there are enough digits
        if not any(char.isdigit() for char in cleaned):
             raise ValueError('Invalid WhatsApp number: must contain digits')
        return cleaned

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserInfo(BaseModel):
    id: int
    email: EmailStr
    is_vendor: bool
    is_admin: bool = False
    vendor_name: Optional[str] = None
    vendor_whatsapp: Optional[str] = None

    class Config:
        from_attributes = True

class ItemBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    price: float = Field(..., gt=0)
    size: str = Field(..., min_length=1)
    market: str = Field(..., min_length=2)
    item_type: Optional[str] = Field("top", description="top, bottom, dress, accessory")
    description: Optional[str] = Field(None, max_length=1000)
    vendor_name: Optional[str] = None
    vendor_whatsapp: Optional[str] = None
    whatsapp: Optional[str] = None

class ItemCreate(ItemBase):
    pass

class ItemImage(BaseModel):
    id: int
    image_path: str
    cloudinary_public_id: Optional[str] = None
    is_primary: bool

    class Config:
        from_attributes = True

class Item(ItemBase):
    id: int
    image_path: str
    cloudinary_public_id: Optional[str] = None
    images: List[ItemImage] = []

    class Config:
        from_attributes = True

class AdminStats(BaseModel):
    total_users: int
    total_vendors: int
    total_items: int
    total_wardrobe_saves: int
    active_vendors: int
    inactive_vendors: int

class AdminUser(BaseModel):
    id: int
    email: str
    is_vendor: bool
    is_admin: bool
    vendor_name: Optional[str] = None

    class Config:
        from_attributes = True

class AdminVendor(BaseModel):
    id: int
    name: str
    whatsapp: Optional[str] = None
    is_active: bool
    is_pinned: bool = False
    item_count: int

    class Config:
        from_attributes = True

class AdminItem(BaseModel):
    id: int
    name: str
    price: float
    size: str
    market: str
    image_path: str
    item_type: Optional[str] = None
    vendor_name: Optional[str] = None

    class Config:
        from_attributes = True

class VendorInfo(BaseModel):
    id: int
    name: str
    whatsapp: Optional[str] = None
    item_count: int = 0

    class Config:
        from_attributes = True
