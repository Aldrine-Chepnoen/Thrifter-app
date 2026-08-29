"""
One-off vendor verification token helpers.

Deliberately separate from make_token()/parse_token() in main.py (login-session
JWTs): this token has its own fixed 7-day expiry regardless of JWT_EXP_SECONDS,
carries a "purpose" claim so it can never be replayed as an auth token (or vice
versa), and decoding never raises — callers get a status string back so the
public confirm endpoint can return 200 with a body instead of a 401 that would
trigger the frontend's auto-logout interceptor.

Signed with VENDOR_VERIFY_SECRET, NOT JWT_SECRET. These tokens live for up to
7 days out in the wild (SMS/email, sometimes printed on a bulk-send CSV) —
rotating JWT_SECRET to force-logout sessions must never silently invalidate
every verification link a vendor hasn't clicked yet.
"""
import jwt
from datetime import datetime, timedelta
from typing import TypedDict, Literal, Optional

from config import settings

PURPOSE = "vendor_verify"
TTL_SECONDS = 7 * 24 * 3600  # 7 days — fixed, independent of JWT_EXP_SECONDS


class VerifyResult(TypedDict):
    status: Literal["ok", "expired", "invalid"]
    vendor_id: Optional[int]
    channel: Optional[str]


def make_vendor_verify_token(vendor_id: int, channel: str = "email") -> str:
    payload = {
        "vid": vendor_id,
        "purpose": PURPOSE,
        "channel": channel,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(seconds=TTL_SECONDS),
    }
    return jwt.encode(payload, settings.VENDOR_VERIFY_SECRET, algorithm="HS256")


def decode_vendor_verify_token(token: str) -> VerifyResult:
    try:
        payload = jwt.decode(token, settings.VENDOR_VERIFY_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        # Still signature-verified, just past its exp — safe to peek at the
        # channel claim so an expired SMS link doesn't tell the vendor to
        # check their email (or vice versa).
        try:
            expired_payload = jwt.decode(
                token, settings.VENDOR_VERIFY_SECRET, algorithms=["HS256"], options={"verify_exp": False}
            )
            channel = expired_payload.get("channel", "email")
        except jwt.InvalidTokenError:
            channel = None
        return {"status": "expired", "vendor_id": None, "channel": channel}
    except jwt.InvalidTokenError:
        return {"status": "invalid", "vendor_id": None, "channel": None}

    if payload.get("purpose") != PURPOSE:
        return {"status": "invalid", "vendor_id": None, "channel": None}

    vid = payload.get("vid")
    if not isinstance(vid, int):
        return {"status": "invalid", "vendor_id": None, "channel": None}

    # Tokens issued before the "channel" claim existed (already-sent email
    # links) default to "email" so they keep working without needing a resend.
    channel = payload.get("channel", "email")

    return {"status": "ok", "vendor_id": vid, "channel": channel}
