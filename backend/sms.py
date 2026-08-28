"""Live transactional SMS via the same Pahappa "Comms" API (EgoSMS) used by
the one-off send_sms_verification.py campaign script — see that file's
docstring for the API details and where it was verified against real docs.

Every send here is best-effort and non-blocking: send_sms() never raises to
its caller and never blocks the request/transaction that triggered it. It
hands off the actual HTTP call to a daemon thread rather than FastAPI's
BackgroundTasks, because some trigger points (the reconciliation sweep,
_reverse_withdrawal) aren't always running inside a request handler, so a
BackgroundTasks object isn't always available — a plain thread works
identically everywhere.

If EGOSMS_USERNAME/EGOSMS_PASSWORD aren't configured (true by default in
dev), sends are logged instead of attempted — no real credentials needed to
run the app locally, and no risk of an accidental real send from a dev box.
"""
import logging
import threading

import requests

from config import settings
from phone_utils import to_egosms_digits

logger = logging.getLogger(__name__)

COMMS_URL = "https://comms.egosms.co/api/v1/json/"


def admin_alert_phones() -> list:
    return [p.strip() for p in settings.ADMIN_ALERT_PHONES.split(",") if p.strip()]


def _post(payload: dict) -> dict:
    body = {"userdata": {"username": settings.EGOSMS_USERNAME, "password": settings.EGOSMS_PASSWORD}, **payload}
    resp = requests.post(COMMS_URL, json=body, headers={"Content-Type": "application/json"}, timeout=15)
    return resp.json()


def _send_now(digits: str, message: str) -> None:
    try:
        result = _post({
            "method": "SendSms",
            "msgdata": [{"number": digits, "message": message, "senderid": settings.EGOSMS_SENDER, "priority": "0"}],
        })
        logger.info(f"SMS sent to {digits}: {result}")
    except Exception as e:
        logger.error(f"SMS send to {digits} failed: {e}", exc_info=True)


def send_sms(phone: str, message: str) -> None:
    digits = to_egosms_digits(phone or "")
    if not digits:
        logger.warning(f"SMS skipped, no usable phone number: {message!r}")
        return
    if not settings.EGOSMS_USERNAME or not settings.EGOSMS_PASSWORD:
        logger.info(f"SMS (dry-run, no EgoSMS credentials configured) to={digits}: {message}")
        return
    threading.Thread(target=_send_now, args=(digits, message), daemon=True).start()


# ---------------------------------------------------------------------------
# Message copy — kept together here so all outbound SMS wording lives in one
# place, in the same "Thrifter: Hi {name}, ..." voice as the verified
# message in send_sms_verification.py.
# ---------------------------------------------------------------------------

def _ugx(amount: float) -> str:
    return f"UGX {amount:,.0f}"


def order_confirmed_buyer_message(checkout) -> str:
    return (
        f"Thrifter: Hi {checkout.delivery_name}, your order (#{checkout.id}) of "
        f"{_ugx(checkout.total_amount)} has been confirmed. We'll text you when it's out for delivery."
    )


def order_confirmed_vendor_message(order) -> str:
    vendor_name = order.vendor.name if order.vendor else "there"
    item_count = len(order.items)
    return (
        f"Thrifter: Hi {vendor_name}, you have a new order! {item_count} item"
        f"{'s' if item_count != 1 else ''} worth {_ugx(order.subtotal)}. Prepare it for pickup."
    )


def order_picked_up_message(order) -> str:
    delivery_name = order.checkout.delivery_name if order.checkout else "there"
    return f"Thrifter: Hi {delivery_name}, your order is on delivery and should arrive soon!"


def order_delivered_vendor_message(order, new_balance: float) -> str:
    vendor_name = order.vendor.name if order.vendor else "there"
    return (
        f"Thrifter: Hi {vendor_name}, order #{order.id} has been delivered. "
        f"{_ugx(order.vendor_payout_amount)} has been added to your wallet. New balance: {_ugx(new_balance)}."
    )


def withdrawal_requested_admin_message(withdrawal, vendor_name: str) -> str:
    return (
        f"Thrifter: {vendor_name} requested a withdrawal of {_ugx(withdrawal.amount)} "
        f"to {withdrawal.destination_phone}. Review it in the admin dashboard."
    )


def withdrawal_paid_message(withdrawal, vendor_name: str) -> str:
    return (
        f"Thrifter: Hi {vendor_name}, your withdrawal of {_ugx(withdrawal.amount)} "
        f"has been sent to {withdrawal.destination_phone}."
    )


def withdrawal_reversed_message(withdrawal, vendor_name: str) -> str:
    return (
        f"Thrifter: Hi {vendor_name}, your withdrawal request of {_ugx(withdrawal.amount)} "
        f"could not be completed and has been returned to your wallet."
    )


def phone_verification_message(vendor_name: str, short_link: str) -> str:
    # Same wording as the bulk campaign in send_sms_verification.py, for a
    # consistent voice regardless of which path sent it.
    return (
        f"Thrifter: Hello {vendor_name}, Please click this link to verify your phone "
        f"number on Thrifter and keep your account active: {short_link}"
    )
