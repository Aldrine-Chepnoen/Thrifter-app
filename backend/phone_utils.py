"""Phone number formatting shared by main.py (storage/display) and sms.py
(outbound SMS) — split out so sms.py can use it without importing main.py.
"""


def format_whatsapp_number(number: str) -> str:
    if not number:
        return ""
    # Remove all spaces, dashes, brackets
    number = number.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    # Already has correct format
    if number.startswith("+256"):
        return number

    # Has 256 without the +
    if number.startswith("256"):
        return "+" + number

    # Local format starting with 0 (e.g. 0772123456)
    if number.startswith("0"):
        return "+256" + number[1:]

    # Just the 9 digit number (e.g. 772123456)
    if len(number) == 9:
        return "+256" + number

    return number


def to_egosms_digits(number: str) -> str:
    """Digits-only format (e.g. "256772123456") — what the EgoSMS Comms API
    expects, verified against real sends in send_sms_verification.py."""
    formatted = format_whatsapp_number(number)
    return formatted.lstrip("+")
