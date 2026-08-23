"""
One-off vendor verification token helpers.

Deliberately separate from make_token()/parse_token() in main.py (login-session
JWTs): this token has its own fixed 7-day expiry regardless of JWT_EXP_SECONDS,
carries a "purpose" claim so it can never be replayed as an auth token (or vice
versa), and decoding never raises — callers get a status string back so the
public confirm endpoint can return 200 with a body instead of a 401 that would
trigger the frontend's auto-logout interceptor.
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


def make_vendor_verify_token(vendor_id: int) -> str:
    payload = {
        "vid": vendor_id,
        "purpose": PURPOSE,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(seconds=TTL_SECONDS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_vendor_verify_token(token: str) -> VerifyResult:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return {"status": "expired", "vendor_id": None}
    except jwt.InvalidTokenError:
        return {"status": "invalid", "vendor_id": None}

    if payload.get("purpose") != PURPOSE:
        return {"status": "invalid", "vendor_id": None}

    vid = payload.get("vid")
    if not isinstance(vid, int):
        return {"status": "invalid", "vendor_id": None}

    return {"status": "ok", "vendor_id": vid}
