from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
from pgvector.sqlalchemy import Vector

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_vendor = Column(Boolean, default=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    vendor = relationship("Vendor")

class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    whatsapp = Column(String, index=True)
    items = relationship("Item", back_populates="vendor")

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    price = Column(Float)
    size = Column(String)
    market = Column(String)
    image_path = Column(String)
    cloudinary_public_id = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    vendor = relationship("Vendor", back_populates="items")
    # CLIP-ViT-B/32 produces 512-dimensional embeddings
    embedding = Column(Vector(512))

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
