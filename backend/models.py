# This file defines the database models for the Thrifter backend application using SQLAlchemy. It includes models for users, vendors, items, blacklisted tokens, and a wardrobe feature. The User model represents registered users of the application, with fields for email, hashed password, and vendor association. The Vendor model represents sellers on the platform, with fields for name, WhatsApp contact, and a relationship to their items. The Item model represents products listed by vendors, including details such as name, price, size, market, image information, description, and an embedding vector for search functionality. The BlacklistedToken model is used to store JWT tokens that have been invalidated. The Wardrobe model allows users to save items they are interested in. These models form the core of the application's data structure and are used throughout the backend for managing data and relationships between entities.
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, Boolean, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from database import Base
from pgvector.sqlalchemy import Vector
import time
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=True)
    google_sub = Column(String, unique=True, index=True, nullable=True)
    is_vendor = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
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
    is_active = Column(Boolean, default=True, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    banner_image = Column(String, nullable=True)
    banner_cloudinary_id = Column(String, nullable=True)
    description = Column(String, nullable=True)
    location = Column(String, nullable=True)
    email_verified_at = Column(DateTime, nullable=True)
    phone_verified_at = Column(DateTime, nullable=True)
    items = relationship("Item", back_populates="vendor")

class ShortLink(Base):
    __tablename__ = "short_links"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    token = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

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
    quantity = Column(Integer, default=1, nullable=False, server_default="1")
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    vendor = relationship("Vendor", back_populates="items")

    # Relationship to multiple images
    images = relationship("ItemImage", back_populates="item", cascade="all, delete-orphan")

    # CLIP-ViT-B/32 produces 512-dimensional embeddings
    embedding = Column(Vector(512))

    # Purchase status: available, reserved (checkout in progress), sold.
    # Derived from `quantity` — recomputed via _recompute_item_status(), never set
    # directly outside main.py's checkout/reservation logic: quantity > 0 => available;
    # quantity == 0 => reserved (an active pending checkout still holds it) or sold.
    status = Column(String, default="available", nullable=False, index=True)

    # Slot-visibility flag for the free/premium vendor tier: True when this item
    # is over its vendor's free slot limit (or the vendor's premium lapsed).
    # Maintained by vendor_premium.sync_vendor_item_visibility() — never set
    # directly elsewhere. Sold items are exempt and never hidden by this flag.
    is_hidden = Column(Boolean, default=False, nullable=False, server_default="false", index=True)

    __table_args__ = (
        Index("ix_items_vendor_id_is_hidden", "vendor_id", "is_hidden"),
    )

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
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

class DemandEntry(Base):
    __tablename__ = "demand_entries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    item_name = Column(String, nullable=False)
    price = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="pending", index=True)  # pending, approved, rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    last_interacted_at = Column(DateTime, nullable=True)

    votes = relationship("DemandVote", back_populates="entry", cascade="all, delete-orphan")
    user = relationship("User")

class DemandVote(Base):
    __tablename__ = "demand_votes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    entry_id = Column(Integer, ForeignKey("demand_entries.id", ondelete="CASCADE"), nullable=False)
    vote_type = Column(String, nullable=False)  # "up" or "down"
    created_at = Column(DateTime, default=datetime.utcnow)

    entry = relationship("DemandEntry", back_populates="votes")

    __table_args__ = (
        UniqueConstraint("user_id", "entry_id", name="uq_demand_vote_user_entry"),
    )

class ItemView(Base):
    __tablename__ = "item_views"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    viewed_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

class Checkout(Base):
    __tablename__ = "checkouts"
    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    delivery_name = Column(String, nullable=False)
    delivery_phone = Column(String, nullable=False)
    delivery_address = Column(Text, nullable=False)
    delivery_day = Column(DateTime, nullable=False)
    subtotal = Column(Float, nullable=False)
    delivery_fee = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    currency = Column(String, default="UGX", nullable=False)
    status = Column(String, default="pending", nullable=False, index=True)  # pending, paid, failed, cancelled, expired
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    buyer = relationship("User")
    orders = relationship("Order", back_populates="checkout", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="checkout", uselist=False, cascade="all, delete-orphan")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    checkout_id = Column(Integer, ForeignKey("checkouts.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    subtotal = Column(Float, nullable=False)
    commission_amount = Column(Float, nullable=False)
    vendor_payout_amount = Column(Float, nullable=False)
    status = Column(String, default="pending", nullable=False, index=True)  # pending, paid, picked_up, delivered, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    # Set only when status == "cancelled" — admin-only action, see _cancel_order.
    cancel_reason = Column(String, nullable=True)  # item_unavailable, buyer_requested, delivery_issue, vendor_unable_to_fulfill, other
    cancel_note = Column(Text, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancelled_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    checkout = relationship("Checkout", back_populates="orders")
    vendor = relationship("Vendor")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    refund = relationship("Refund", back_populates="order", uselist=False)

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    # Nullable so a cancelled order's item can be deleted from the catalog
    # (reason="item_unavailable") without losing the order's own history —
    # item_name_snapshot/price_at_purchase below carry the durable record.
    item_id = Column(Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, nullable=False, server_default="1")
    price_at_purchase = Column(Float, nullable=False)
    item_name_snapshot = Column(String, nullable=False)

    order = relationship("Order", back_populates="items")
    item = relationship("Item")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    checkout_id = Column(Integer, ForeignKey("checkouts.id", ondelete="CASCADE"), nullable=False, unique=True)
    provider = Column(String, nullable=False)  # "nylon"
    tx_ref = Column(String, unique=True, index=True, nullable=False)
    provider_tx_id = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False, index=True)  # pending, successful, failed
    amount = Column(Float, nullable=False)
    currency = Column(String, default="UGX", nullable=False)
    failure_reason = Column(Text, nullable=True)
    raw_response = Column(Text, nullable=True)  # JSON-encoded
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    checkout = relationship("Checkout", back_populates="payment")

class Refund(Base):
    """Buyer-side money-back record for an admin-cancelled order. Distinct from
    VendorWithdrawal (vendor payout) — this pays the buyer back via the same
    provider.payout() mechanism, since Nylon Pay has no native refund call."""
    __tablename__ = "refunds"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True)
    checkout_id = Column(Integer, ForeignKey("checkouts.id"), nullable=False, index=True)
    subtotal_refunded = Column(Float, nullable=False)
    # Non-zero only when cancelling this order also drops the checkout's
    # delivery-fee tier (e.g. multi-vendor -> single-vendor) — see _cancel_order.
    delivery_fee_refunded = Column(Float, nullable=False, default=0)
    amount = Column(Float, nullable=False)  # subtotal_refunded + delivery_fee_refunded
    currency = Column(String, default="UGX", nullable=False)
    destination_phone = Column(String, nullable=False)
    destination_name = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False, index=True)  # pending, successful, failed
    provider = Column(String, nullable=True)
    provider_ref = Column(String, nullable=True)
    failure_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", back_populates="refund")

class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, nullable=False, index=True)
    tx_ref = Column(String, nullable=True, index=True)
    provider_event_id = Column(String, nullable=True, index=True)
    payload = Column(Text, nullable=False)  # JSON-encoded
    signature_valid = Column(Boolean, default=False, nullable=False)
    processed = Column(Boolean, default=False, nullable=False, index=True)
    received_at = Column(DateTime, default=datetime.utcnow)

# NOTE: the old VendorPayout model (and its "vendor_payouts" table) has been
# retired in favor of VendorWalletTransaction/VendorWithdrawal below — it
# credited at payment time rather than delivery time and never got a UI. The
# "vendor_payouts" table itself is deliberately left in place in the DB
# (unused, not dropped) rather than risk a destructive migration on a live
# database for a handful of rows nothing ever read.

class VendorWalletTransaction(Base):
    """Append-only ledger — a vendor's wallet balance is always
    SUM(amount) for their vendor_id, never a stored mutable field, so it
    can't drift out of sync with reality."""
    __tablename__ = "vendor_wallet_transactions"
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)  # positive = credit, negative = debit
    reason = Column(String, nullable=False, index=True)  # delivery, withdrawal_requested, withdrawal_reversed
    # Set only for reason="delivery" — UNIQUE blocks double-crediting the same order.
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True, unique=True)
    withdrawal_id = Column(Integer, ForeignKey("vendor_withdrawals.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    vendor = relationship("Vendor")

class VendorWithdrawal(Base):
    __tablename__ = "vendor_withdrawals"
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    # Snapshot of vendor.whatsapp at request time — protects against the
    # vendor changing it between requesting and an admin approving.
    destination_phone = Column(String, nullable=False)
    status = Column(String, default="pending_approval", nullable=False, index=True)  # pending_approval, paid, rejected, failed
    provider = Column(String, nullable=True)
    provider_ref = Column(String, nullable=True)
    failure_reason = Column(Text, nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    vendor = relationship("Vendor")

class VendorSubscription(Base):
    __tablename__ = "vendor_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False, index=True)
    provider = Column(String, nullable=False)  # "nylon"
    tx_ref = Column(String, unique=True, index=True, nullable=False)
    provider_tx_id = Column(String, nullable=True, index=True)
    status = Column(String, default="pending", nullable=False, index=True)  # pending, successful, failed
    amount = Column(Float, nullable=False)
    currency = Column(String, default="UGX", nullable=False)
    period_days = Column(Integer, nullable=False, default=30)
    starts_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)
    failure_reason = Column(Text, nullable=True)
    raw_response = Column(Text, nullable=True)  # JSON-encoded
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("Vendor")
