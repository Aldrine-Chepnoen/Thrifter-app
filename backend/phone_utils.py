"""Phone number formatting shared by main.py (storage/display) and sms.py
(outbound SMS) — split out so sms.py can use it without importing main.py.
"""
import re

# A valid formatted number is always +256 followed by exactly 9 digits.
_VALID_UG_NUMBER = re.compile(r"^\+256\d{9}$")


def format_whatsapp_number(number: str) -> str:
    if not number:
        return ""
    # Remove all spaces, dashes, brackets
    number = number.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    if number.startswith("+256"):
        formatted = number
    elif number.startswith("256"):
        # Has 256 without the +
        formatted = "+" + number
    elif number.startswith("0"):
        # Local format starting with 0 (e.g. 0772123456)
        formatted = "+256" + number[1:]
    elif len(number) == 9:
        # Just the 9 digit number (e.g. 772123456)
        formatted = "+256" + number
    else:
        formatted = number

    # Reject anything that isn't exactly +256 plus 9 digits — e.g. two
    # numbers pasted together with a separator, letters, wrong length.
    # Every caller already treats "" as "invalid, reject" (register,
    # vendor-upgrade via get_or_create_vendor, PUT /vendor/me), so this is
    # a strict-validate-or-empty function, not a best-effort formatter.
    if not _VALID_UG_NUMBER.match(formatted):
        return ""
    return formatted


def to_egosms_digits(number: str) -> str:
    """Digits-only format (e.g. "256772123456") — what the EgoSMS Comms API
    expects, verified against real sends in send_sms_verification.py."""
    formatted = format_whatsapp_number(number)
    return formatted.lstrip("+")
