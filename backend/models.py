# This file defines the database models for the Thrifter backend application using SQLAlchemy. It includes models for users, vendors, items, blacklisted tokens, and a wardrobe feature. The User model represents registered users of the application, with fields for email, hashed password, and vendor association. The Vendor model represents sellers on the platform, with fields for name, WhatsApp contact, and a relationship to their items. The Item model represents products listed by vendors, including details such as name, price, size, market, image information, description, and an embedding vector for search functionality. The BlacklistedToken model is used to store JWT tokens that have been invalidated. The Wardrobe model allows users to save items they are interested in. These models form the core of the application's data structure and are used throughout the backend for managing data and relationships between entities.
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from database import Base
from pgvector.sqlalchemy import Vector
import time
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_vendor = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    vendor = relationship("Vendor")

class VisualCluster(Base):
    __tablename__ = "visual_clusters"
    id = Column(Integer, primary_key=True, index=True)
    ai_label = Column(String)
    custom_name = Column(String, nullable=True)
    centroid_embedding = Column(Vector(512))
    sample_item_ids = Column(Text, default="[]") # JSON list
    created_at = Column(Float, default=time.time)

class StyleCategory(Base):
    __tablename__ = "style_categories"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    
    # Foreign keys to visual clusters
    top_cluster_id = Column(Integer, ForeignKey("visual_clusters.id"), nullable=True)
    bottom_cluster_id = Column(Integer, ForeignKey("visual_clusters.id"), nullable=True)
    accessory_cluster_id = Column(Integer, ForeignKey("visual_clusters.id"), nullable=True)

    # Relationships
    top_cluster = relationship("VisualCluster", foreign_keys=[top_cluster_id])
    bottom_cluster = relationship("VisualCluster", foreign_keys=[bottom_cluster_id])
    accessory_cluster = relationship("VisualCluster", foreign_keys=[accessory_cluster_id])

    is_approved = Column(Boolean, default=False)
    cover_image_path = Column(String, nullable=True)
    cover_cloudinary_id = Column(String, nullable=True)
    sample_item_ids = Column(Text, default="[]") # JSON list [id, id, ...]
    created_at = Column(Float, default=time.time)
    updated_at = Column(Float, default=time.time, onupdate=time.time)

class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    whatsapp = Column(String, index=True)
    is_active = Column(Boolean, default=True)
    is_pinned = Column(Boolean, default=False)
    items = relationship("Item", back_populates="vendor")

class AppSetting(Base):
    __tablename__ = "app_settings"
    key = Column(String, primary_key=True)
    value_bool = Column(Boolean, default=False, nullable=False)
    value_float = Column(Float, nullable=True)
    value_str = Column(String, nullable=True)

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    price = Column(Float)
    size = Column(String)
    market = Column(String)
    image_path = Column(String)
    item_type = Column(String, default="top", index=True) # top, bottom, dress, accessory
    cloudinary_public_id = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    vendor = relationship("Vendor", back_populates="items")

    # Relationship to multiple images
    images = relationship("ItemImage", back_populates="item", cascade="all, delete-orphan")

    # CLIP-ViT-B/32 produces 512-dimensional embeddings
    embedding = Column(Vector(512))

class ItemImage(Base):
    __tablename__ = "item_images"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    image_path = Column(String, nullable=False)
    cloudinary_public_id = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False)

    item = relationship("Item", back_populates="images")

class BlacklistedToken(Base):
    __tablename__ = "blacklisted_tokens"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True)
    blacklisted_on = Column(Float) # Timestamp

class Wardrobe(Base):
    __tablename__ = "wardrobe"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)

class ItemView(Base):
    __tablename__ = "item_views"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    viewed_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
