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
        if v and not re.fullmatch(r"\+?\d{10,15}", v):
            raise ValueError('Invalid WhatsApp number format')
        return v

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserInfo(BaseModel):
    id: int
    email: EmailStr
    is_vendor: bool
    vendor_name: Optional[str] = None
    vendor_whatsapp: Optional[str] = None

    class Config:
        from_attributes = True

class ItemBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    price: float = Field(..., gt=0)
    size: str = Field(..., min_length=1)
    market: str = Field(..., min_length=2)
    description: Optional[str] = Field(None, max_length=1000)
    vendor_name: Optional[str] = None
    vendor_whatsapp: Optional[str] = None
    whatsapp: Optional[str] = None

class ItemCreate(ItemBase):
    pass

class Item(ItemBase):
    id: int
    image_path: str
    cloudinary_public_id: Optional[str] = None

    class Config:
        from_attributes = True

class VendorInfo(BaseModel):
    id: int
    name: str
    whatsapp: Optional[str] = None
    item_count: int = 0

    class Config:
        from_attributes = True
