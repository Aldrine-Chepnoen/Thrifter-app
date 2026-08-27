"""
Vendor premium tier: free-slot limiting and lazy subscription-expiry checks.

Free vendors get settings.VENDOR_FREE_ITEM_LIMIT active item slots; premium
vendors (paid, tracked via VendorSubscription) get unlimited slots. There is
no scheduled job — expiry is only ever checked lazily, on request, by calling
sync_vendor_item_visibility() from the relevant endpoints (upload, vendor
subscription status, vendor page). Items with status="sold" never count
against the limit and are never hidden by this module.
"""
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

import models
from config import settings

ACTIVE_STATUSES = ("available", "reserved")


def is_vendor_premium(db: Session, vendor_id: Optional[int]) -> bool:
    if not vendor_id:
        return False
    latest = (
        db.query(models.VendorSubscription)
        .filter(
            models.VendorSubscription.vendor_id == vendor_id,
            models.VendorSubscription.status == "successful",
        )
        .order_by(models.VendorSubscription.expires_at.desc())
        .first()
    )
    return bool(latest and latest.expires_at and latest.expires_at > datetime.utcnow())


def sync_vendor_item_visibility(db: Session, vendor: models.Vendor) -> List[int]:
    """Reapplies the free/premium slot-visibility rule for one vendor.

    Ranks only non-sold items by id desc (newest first, since Item has no
    created_at and id is strictly insertion-ordered here). Premium vendors get
    everything unhidden; free vendors keep the newest VENDOR_FREE_ITEM_LIMIT
    unhidden and hide the rest. Idempotent — a steady-state call does no
    writes. Returns the ids whose is_hidden flipped, so callers can invalidate
    the per-item cache for exactly those items.
    """
    items = (
        db.query(models.Item)
        .filter(models.Item.vendor_id == vendor.id, models.Item.status.in_(ACTIVE_STATUSES))
        .order_by(models.Item.id.desc())
        .all()
    )
    premium = is_vendor_premium(db, vendor.id)
    changed_ids = []
    for idx, item in enumerate(items):
        should_hide = (not premium) and idx >= settings.VENDOR_FREE_ITEM_LIMIT
        if item.is_hidden != should_hide:
            item.is_hidden = should_hide
            changed_ids.append(item.id)
    if changed_ids:
        db.commit()
    return changed_ids


def finalize_subscription_payment(db: Session, subscription: models.VendorSubscription, status: str) -> List[int]:
    """Activates (or fails) a pending subscription payment. Idempotent — a
    replayed webhook after the subscription already reached a terminal state
    is a no-op, mirroring main.py's _finalize_payment(). Returns item ids
    whose is_hidden flipped as a result (empty on failure or replay)."""
    if subscription.status in ("successful", "failed"):
        return []
    subscription.status = status
    if status == "successful":
        now = datetime.utcnow()
        subscription.starts_at = now
        subscription.expires_at = now + timedelta(days=subscription.period_days)
    db.commit()

    if status != "successful":
        return []

    vendor = db.query(models.Vendor).filter(models.Vendor.id == subscription.vendor_id).first()
    if not vendor:
        return []
    return sync_vendor_item_visibility(db, vendor)
