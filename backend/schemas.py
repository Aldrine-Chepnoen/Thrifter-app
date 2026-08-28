# This file defines the Pydantic schemas for the Thrifter backend application. These schemas are used for data validation and serialization when handling API requests and responses. The UserCreate schema is used for user registration, ensuring that the email, password, and optional vendor information are properly validated. The Token schema defines the structure of the JWT token response after successful authentication. The UserInfo schema represents the user information that can be returned in API responses, while the ItemBase, ItemCreate, and Item schemas define the structure of item data for creation and retrieval. Finally, the VendorInfo schema provides a structure for representing vendor information in API responses. These schemas help ensure that data is consistently structured and validated across the application.
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
import re

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    is_vendor: bool = False
    vendor_name: Optional[str] = Field(None, min_length=2)
    vendor_whatsapp: Optional[str] = None
    vendor_location: Optional[str] = Field(None, max_length=200)

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

    @validator('vendor_location', always=True)
    def validate_vendor_location(cls, v, values):
        if not values.get('is_vendor'):
            return v
        cleaned = (v or '').strip()
        if len(cleaned) < 2:
            raise ValueError('Pickup location is required for business/vendor accounts')
        return cleaned

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class GoogleAuthRequest(BaseModel):
    credential: str
    confirm_signup: bool = False

class GoogleAuthResponse(Token):
    is_new_user: bool

class GoogleAuthNeedsConfirmation(BaseModel):
    needs_confirmation: bool = True
    email: EmailStr

class VendorUpgrade(BaseModel):
    vendor_name: str = Field(..., min_length=2)
    vendor_whatsapp: str
    vendor_location: str = Field(..., min_length=2, max_length=200)

    @validator('vendor_whatsapp')
    def validate_whatsapp(cls, v):
        cleaned = v.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if not any(char.isdigit() for char in cleaned):
            raise ValueError('Invalid WhatsApp number: must contain digits')
        return cleaned

    @validator('vendor_location')
    def validate_vendor_location(cls, v):
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError('Pickup location is required')
        return cleaned

class VendorUpdate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    whatsapp: str
    description: Optional[str] = None
    # Not required here: editing unrelated profile fields (name, whatsapp, bio)
    # must not be blocked by a missing location. The plan is to enforce it via
    # feed visibility instead (hide items from vendors with no location set),
    # but that filtering isn't implemented yet — today, vendors without a
    # location still show up normally.
    location: Optional[str] = Field(None, max_length=200)

    @validator('location')
    def validate_location(cls, v):
        if not v:
            return None
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError('Pickup location must be at least 2 characters')
        return cleaned

class ReverseGeocodeRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)

class ReverseGeocodeResponse(BaseModel):
    address: str

class UserInfo(BaseModel):
    id: int
    email: EmailStr
    is_vendor: bool
    is_admin: bool = False
    vendor_name: Optional[str] = None
    vendor_whatsapp: Optional[str] = None
    is_premium: bool = False

    class Config:
        from_attributes = True

class ItemBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    price: float = Field(..., gt=0)
    size: str = Field(..., min_length=1)
    market: Optional[str] = Field(None, min_length=2)
    item_type: Optional[str] = Field("top", description="top, bottom, dress, accessory")
    description: Optional[str] = Field(None, max_length=1000)
    vendor_name: Optional[str] = None
    vendor_whatsapp: Optional[str] = None
    whatsapp: Optional[str] = None
    quantity: int = Field(1, ge=0)

class ItemCreate(ItemBase):
    pass

class ItemImage(BaseModel):
    id: int
    image_path: str
    cloudinary_public_id: Optional[str] = None
    # Cloudinary URL served to sessions that can't reach the R2 domain
    fallback_url: Optional[str] = None
    is_primary: bool

    class Config:
        from_attributes = True

class Item(ItemBase):
    id: int
    image_path: str
    cloudinary_public_id: Optional[str] = None
    fallback_url: Optional[str] = None
    images: List[ItemImage] = []
    status: str = "available"
    is_hidden: bool = False

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
    email_verified_at: Optional[datetime] = None
    phone_verified_at: Optional[datetime] = None
    item_count: int

    class Config:
        from_attributes = True

class VendorVerifyRequest(BaseModel):
    token: str

class VendorVerifyResponse(BaseModel):
    status: str  # "confirmed" | "expired" | "invalid"
    vendor_name: Optional[str] = None

class VendorVerifyLocationRequest(BaseModel):
    token: str
    location: str = Field(..., min_length=1, max_length=200)

class BulkVendorIds(BaseModel):
    vendor_ids: List[int] = Field(..., min_length=1)

class AdminItem(BaseModel):
    id: int
    name: str
    price: float
    size: str
    market: Optional[str] = None
    image_path: str
    item_type: Optional[str] = None
    vendor_name: Optional[str] = None

    class Config:
        from_attributes = True

class VisualClusterBase(BaseModel):
    ai_label: str
    custom_name: Optional[str] = None
    sample_item_ids: str = "[]"

class VisualClusterCreate(VisualClusterBase):
    pass

class VisualClusterUpdate(BaseModel):
    custom_name: Optional[str] = None

class ManualClusterCreate(BaseModel):
    name: str
    item_ids: List[int]

class VisualCluster(VisualClusterBase):
    id: int
    created_at: float

    class Config:
        from_attributes = True

class StyleCategoryBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    is_approved: bool = False
    sample_item_ids: str = "[]"
    cover_image_path: Optional[str] = None
    cover_cloudinary_id: Optional[str] = None
    top_cluster_id: Optional[int] = None
    bottom_cluster_id: Optional[int] = None
    accessory_cluster_id: Optional[int] = None

class StyleCategoryCreate(StyleCategoryBase):
    pass

class StyleCategory(StyleCategoryBase):
    id: int
    created_at: float
    updated_at: float
    cover_fallback_url: Optional[str] = None

    top_cluster: Optional[VisualCluster] = None
    bottom_cluster: Optional[VisualCluster] = None
    accessory_cluster: Optional[VisualCluster] = None
    sample_items: List[Item] = []

    class Config:
        from_attributes = True

class StyleCategoryItems(BaseModel):
    tops: List[Item]
    bottoms: List[Item]
    accessories: List[Item]

class VendorInfo(BaseModel):
    id: int
    name: str
    whatsapp: Optional[str] = None
    item_count: int = 0
    banner_image: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None

    class Config:
        from_attributes = True

class VendorSearchResult(BaseModel):
    id: int
    name: str
    banner_image: Optional[str] = None
    banner_fallback_url: Optional[str] = None
    location: Optional[str] = None
    item_count: int = 0

class VendorProfile(BaseModel):
    id: int
    name: str
    item_count: int = 0
    banner_image: Optional[str] = None
    banner_fallback_url: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    is_premium: bool = False
    hidden_item_count: Optional[int] = None  # owner-only; None for visitors

    class Config:
        from_attributes = True

class DemandEntryCreate(BaseModel):
    item_name: str = Field(..., min_length=2, max_length=100)
    price: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=300)

class DemandEntryResponse(BaseModel):
    id: int
    item_name: str
    price: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    upvotes: int
    downvotes: int
    score: int
    user_vote: Optional[str] = None

class DemandEntryAdminResponse(BaseModel):
    id: int
    item_name: str
    price: str
    description: Optional[str] = None
    created_at: datetime
    submitter_email: Optional[str] = None

class DemandVoteRequest(BaseModel):
    vote_type: str = Field(..., pattern="^(up|down)$")

class DemandStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")

class DemandEntryUpdate(BaseModel):
    item_name: Optional[str] = Field(None, min_length=2, max_length=100)
    price: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=300)

class CheckoutItemRequest(BaseModel):
    item_id: int
    quantity: int = Field(1, ge=1)

class CheckoutCreate(BaseModel):
    items: List[CheckoutItemRequest] = Field(..., min_length=1, max_length=20)
    delivery_name: str = Field(..., min_length=2, max_length=100)
    delivery_phone: str = Field(..., min_length=7, max_length=20)
    delivery_address: str = Field(..., min_length=5, max_length=500)

class OrderItemOut(BaseModel):
    id: int
    item_id: int
    item_name_snapshot: str
    price_at_purchase: float
    quantity: int = 1
    image_path: Optional[str] = None
    fallback_url: Optional[str] = None

class OrderOut(BaseModel):
    id: int
    vendor_id: int
    vendor_name: Optional[str] = None
    subtotal: float
    status: str
    items: List[OrderItemOut] = []

class CheckoutOut(BaseModel):
    id: int
    delivery_name: str
    delivery_phone: str
    delivery_address: str
    delivery_day: datetime
    subtotal: float
    delivery_fee: float
    total_amount: float
    currency: str
    status: str
    orders: List[OrderOut] = []

class PaymentInitiateRequest(BaseModel):
    provider: str = Field(..., pattern="^nylon$")

class PaymentInitiateResponse(BaseModel):
    redirect_url: str
    tx_ref: str

class VendorSubscriptionStatus(BaseModel):
    is_premium: bool
    expires_at: Optional[datetime] = None
    active_item_count: int
    hidden_item_count: int
    free_item_limit: int
    price_ugx: float
    currency: str = "UGX"
    pending_payment: bool = False

class VendorOrderOut(BaseModel):
    id: int
    checkout_id: int
    subtotal: float
    commission_amount: float
    vendor_payout_amount: float
    status: str
    created_at: datetime
    delivery_day: datetime
    items: List[OrderItemOut] = []

class AdminOrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(picked_up|delivered)$")

class AdminOrderOut(BaseModel):
    id: int
    checkout_id: int
    vendor_id: int
    vendor_name: Optional[str] = None
    vendor_whatsapp: Optional[str] = None
    vendor_location: Optional[str] = None
    delivery_name: str
    delivery_phone: str
    delivery_address: str
    subtotal: float
    commission_amount: float
    vendor_payout_amount: float
    status: str
    created_at: datetime
    delivery_day: datetime
    items: List[OrderItemOut] = []

class VendorWithdrawalOut(BaseModel):
    id: int
    amount: float
    status: str
    requested_at: datetime
    reviewed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None

class VendorWalletStatus(BaseModel):
    balance: float
    currency: str = "UGX"
    pending_withdrawal: Optional[VendorWithdrawalOut] = None

class AdminWithdrawalOut(BaseModel):
    id: int
    vendor_id: int
    vendor_name: Optional[str] = None
    destination_phone: str
    amount: float
    status: str
    failure_reason: Optional[str] = None
    requested_at: datetime
    reviewed_at: Optional[datetime] = None

class DailyViewCount(BaseModel):
    date: str
    count: int

class ItemViewStats(BaseModel):
    total: int
    last_7_days: int
    last_30_days: int
    daily: List[DailyViewCount]
