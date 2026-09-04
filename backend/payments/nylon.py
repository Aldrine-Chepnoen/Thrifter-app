import json
import re
import uuid
from typing import Optional, Dict, Any

from nylonpay import create_nylon_pay, SdkException, VerifyWebhookInput, verify_webhook_signature, Customer, Destination

from config import settings
from .base import PaymentProvider, InitiateResult, WebhookResult, PayoutResult, VerifyResult, HealthCheckResult


# Nylon Pay's status_text/failureReason mixes plain-language phrases (e.g. "you
# probably have insufficient balance") with raw enum-like codes (e.g.
# "COULD_NOT_PERFORM_TRANSACTION") depending on which failure path produced
# them. Known codes are translated for the vendor/buyer-facing UI; a
# human phrase is matched by keyword against the same known cases (Nylon Pay's
# own phrasing is inconsistently cased/punctuated, so it's shown as raw text
# only as a last resort); anything else that looks like a raw code falls back
# to one generic, still-actionable message instead of showing a bare
# SCREAMING_SNAKE_CASE string.
_FAILURE_REASON_MESSAGES = {
    "COULD_NOT_PERFORM_TRANSACTION": "The payment couldn't be completed on your phone — usually an incorrect PIN, insufficient balance, or the request being declined. Please check and try again.",
    "INSUFFICIENT_BALANCE": "Not enough balance on your mobile money account. Please top up and try again.",
    "CANCELLED_BY_USER": "The payment was cancelled before it completed. Please try again.",
    "TRANSACTION_TIMEOUT": "The payment request timed out before it was approved. Please try again.",
    "INVALID_PIN": "The mobile money PIN entered was incorrect. Please try again.",
}

# Keyword fallback for when Nylon Pay sends a free-form human phrase (e.g. "you
# probably have insufficient balance") instead of one of the enum codes above —
# matched against the lowercased raw text so it still resolves to the same
# pre-written message rather than being shown to the vendor/buyer verbatim.
_FAILURE_REASON_KEYWORDS = [
    ("insufficient balance", "INSUFFICIENT_BALANCE"),
    ("insufficient funds", "INSUFFICIENT_BALANCE"),
    ("cancel", "CANCELLED_BY_USER"),
    ("timed out", "TRANSACTION_TIMEOUT"),
    ("timeout", "TRANSACTION_TIMEOUT"),
    ("pin", "INVALID_PIN"),
]


def _sentence_case(text: str) -> str:
    # `failureReason`/`status_text` has no fixed vocabulary — it's free text
    # relayed from the underlying mobile money network, so phrasings we don't
    # recognize will keep showing up. This is the last-resort safety net for
    # those: it can't fix wording, but it stops a lowercase, unpunctuated
    # provider string (e.g. "you probably have insufficient balance") from
    # reaching the vendor/buyer looking like a raw log line.
    text = text.strip()
    if not text:
        return text
    capitalized = text[0].upper() + text[1:]
    if capitalized[-1] not in ".!?":
        capitalized += "."
    return capitalized


def _humanize_failure_reason(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return raw
    key = raw.strip()
    mapped = _FAILURE_REASON_MESSAGES.get(key.upper())
    if mapped:
        return mapped
    lowered = key.lower()
    for keyword, code in _FAILURE_REASON_KEYWORDS:
        if keyword in lowered:
            return _FAILURE_REASON_MESSAGES[code]
    if key != key.upper() or " " in key:
        return _sentence_case(key)
    return "The payment couldn't be completed. Please check your mobile money balance and PIN, then try again."


_ERROR_CODE_PREFIX = re.compile(r"^\[[A-Za-z0-9_-]+\]\s*")


def _try_parse_json(text: str) -> Optional[Any]:
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        return None


def _humanize_payout_failure(raw: Optional[str]) -> Optional[str]:
    """Payout (vendor withdrawal) failures come from a different part of Nylon
    Pay's API than the collection failures above, with different failure modes
    (destination/account/provider-availability issues, not a buyer's PIN entry)
    — so this gets its own message handling rather than reusing the buyer-facing
    collection copy, whose keyword matches and generic fallback don't fit here.

    `raw` may be a plain string from a caught `SdkException` (validation errors
    caught before any network call), or a JSON-serialized SdkError
    (category/message/retryable) from a rejected `Result` — both are handled.
    """
    if not raw:
        return raw
    text = raw.strip()
    category: Optional[str] = None
    parsed_json = _try_parse_json(text)
    if isinstance(parsed_json, dict) and isinstance(parsed_json.get("message"), str):
        if isinstance(parsed_json.get("category"), str):
            category = parsed_json["category"]
        text = parsed_json["message"]
    # Nylon Pay tags some messages with a support-ticket-style prefix like
    # "[LUlcio] ..." — meaningless to whoever reads this, so it's dropped.
    text = _ERROR_CODE_PREFIX.sub("", text).strip()
    message = _sentence_case(text) if text else "The payout couldn't be completed."
    if category == "provider":
        # This came from Nylon Pay's own systems/policy, not from anything we
        # sent — say so plainly, so a provider-side pause/outage doesn't get
        # mistaken for a Thrifter bug (that exact confusion is why this exists).
        return f"Nylon Pay: {message}"
    return message


class NylonPayProvider(PaymentProvider):
    name = "nylon"

    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not settings.NYLONPAY_API_KEY or not settings.NYLONPAY_API_SECRET:
                raise RuntimeError("NYLONPAY_API_KEY / NYLONPAY_API_SECRET not configured")
            self._client = create_nylon_pay(
                api_key=settings.NYLONPAY_API_KEY,
                api_secret=settings.NYLONPAY_API_SECRET,
            )
        return self._client

    def initiate(
        self,
        *,
        tx_ref: str,
        amount: float,
        currency: str,
        customer_email: str,
        customer_name: str,
        customer_phone: str,
        redirect_url: str,
    ) -> InitiateResult:
        client = self._get_client()
        # Nylon Pay requires `reference` to be a valid UUID — our internal tx_ref
        # (format "THR-{checkout_id}-{hex10}") isn't one, so mint a separate UUID
        # here and track it as provider_ref instead of reusing tx_ref.
        reference = str(uuid.uuid4())
        try:
            client.collect_payment(
                amount=int(round(amount)),
                currency=currency,
                customer={"name": customer_name, "phone_number": customer_phone, "email": customer_email or None},
                description="Thrifter order",
                reference=reference,
            )
        except SdkException as e:
            raise RuntimeError(f"Nylon Pay collection failed [{e.category}]: {e}") from e
        # collect_payment() is event-driven: it never raises on a transport-level
        # failure (e.g. retries exhausted against a 502) — that gets swallowed into
        # the returned PaymentInstance's internal event state instead, which we
        # never read here. Confirm the reference actually registered with Nylon Pay
        # before telling the buyer a PIN prompt is on its way; otherwise a collection
        # request that never left our server gets reported back as a success.
        status_check = client.get_status(reference=reference)
        if not status_check.is_ok:
            raise RuntimeError(f"Nylon Pay could not confirm collection {reference}: {status_check.error}")
        # Mobile money collections have no hosted checkout page — the customer approves
        # on their own phone. Send the buyer straight to our confirmation page, which
        # already polls GET /checkout/{id} until the webhook (or verify()) resolves it.
        return InitiateResult(redirect_url=redirect_url, tx_ref=tx_ref, provider_ref=reference)

    def verify(self, tx_ref: str, provider_ref: Optional[str] = None) -> VerifyResult:
        if not provider_ref:
            return VerifyResult(status="pending")
        result = self._get_client().get_status(reference=provider_ref)
        if not result.is_ok:
            return VerifyResult(status="pending")
        status = result.value.status
        if status == "successful":
            return VerifyResult(status="successful")
        if status in ("failed", "cancelled"):
            # `status_text` is Nylon Pay's human-readable reason (e.g. "Insufficient
            # balance") for the StatusResponse returned by get_status — surfaced so
            # callers can show the vendor/buyer why their payment didn't go through.
            return VerifyResult(status="failed", failure_reason=_humanize_failure_reason(result.value.status_text))
        return VerifyResult(status="pending")  # pending, processing, on_hold

    def parse_webhook(self, headers: Dict[str, str], data: Dict[str, Any]) -> WebhookResult:
        # `data` must include the raw request body under "_raw_body" — verification
        # runs against the exact bytes Nylon Pay signed, not a re-serialized dict.
        raw_body = data.get("_raw_body", b"")
        signature = headers.get("x-nylon-signature", "")
        valid = verify_webhook_signature(VerifyWebhookInput(
            payload=raw_body,
            signature=signature,
            secret=settings.NYLONPAY_WEBHOOK_SECRET or "",
        ))
        # Nylon Pay's webhook body matches the SDK's WebhookPayload shape
        # (delivery_id/event/payload/timestamp) — the transaction fields we care
        # about are nested under "payload" (confirmed against the installed SDK's
        # WebhookTransactionSnapshot dataclass, not just assumed).
        payload = data.get("payload", {}) if valid else {}
        status_map = {"successful": "successful", "failed": "failed", "cancelled": "failed"}
        # Nylon Pay's webhook never echoes back our internal tx_ref — only the UUID
        # `reference` we minted in initiate() (stored as Payment.provider_tx_id).
        # The nylonpay_webhook handler in main.py looks payments up by that field,
        # not by tx_ref, to account for this.
        return WebhookResult(
            valid=valid,
            tx_ref=payload.get("reference"),
            provider_tx_id=payload.get("transactionId"),
            status=status_map.get(payload.get("status"), "pending"),
            failure_reason=_humanize_failure_reason(payload.get("failureReason")),
            raw=data,
        )

    def payout(
        self,
        *,
        tx_ref: str,
        amount: float,
        currency: str,
        destination_phone: str,
        destination_name: str,
        description: str,
    ) -> PayoutResult:
        client = self._get_client()
        reference = str(uuid.uuid4())
        # Mobile-money payout: the "account" is the phone number itself, so
        # account_number and phone both carry it. No bank_name — this isn't
        # a bank transfer. Field mapping confirmed against Nylon Pay's
        # published Destination spec (account_holder_name/account_number/
        # bank_name/phone).
        try:
            result = client.make_payout_and_resolve(
                amount=int(round(amount)),
                currency=currency,
                customer=Customer(name=destination_name, phone_number=destination_phone, email=None),
                destination=Destination(
                    account_holder_name=destination_name,
                    account_number=destination_phone,
                    bank_name=None,
                    phone=destination_phone,
                ),
                description=description,
                reference=reference,
            )
        except SdkException as e:
            return PayoutResult(success=False, status="failed", failure_reason=_humanize_payout_failure(f"[{e.category}] {e}"))

        if result.is_err:
            return PayoutResult(success=False, status="failed", failure_reason=_humanize_payout_failure(str(result.error)))

        txn = result.value
        if txn.status == "successful":
            return PayoutResult(success=True, status="successful", provider_ref=txn.id)
        return PayoutResult(success=False, status=txn.status, provider_ref=txn.id, failure_reason=_humanize_payout_failure(txn.failure_reason))

    def health_check(self) -> HealthCheckResult:
        """Cheap, side-effect-free probe of whether Nylon Pay's shared API
        endpoint is reachable at all — lets an admin check before retrying a
        withdrawal instead of probing with a real payout. Queries a reference
        that can't possibly exist: getting back a clean "not_found" IS the
        healthy signal (Nylon Pay understood and answered the request); any
        other outcome (network failure, or Nylon Pay rejecting the request
        outright) is not.

        Scope limitation: every SDK operation (collect_payment, make_payout,
        get_status, ...) shares one HTTP endpoint, distinguished only by an
        `action` field in the request body — so this only confirms that
        endpoint is up, via the get_status action specifically. Nylon Pay can
        (and has) selectively paused just ONE action family — e.g. "Payouts
        are temporarily paused for maintenance" — while collect_payment and
        get_status kept working fine for other users at the very same time.
        A "reachable" result here does NOT mean payouts specifically are
        enabled; it only rules out a full outage like the one this check was
        built to catch. There's no safe way to probe make_payout more
        directly without sending a real payout, which this deliberately never does.
        """
        client = self._get_client()
        probe_reference = str(uuid.uuid4())
        try:
            result = client.get_status(reference=probe_reference)
        except SdkException as e:
            return HealthCheckResult(healthy=False, message=_humanize_payout_failure(f"[{e.category}] {e}") or "Nylon Pay's API is not reachable.")

        if result.is_ok:
            return HealthCheckResult(healthy=True, message="Nylon Pay's API is reachable. This doesn't confirm payouts specifically are enabled — Nylon Pay can pause just that feature while the rest of the API keeps working.")

        parsed = _try_parse_json(str(result.error))
        category = parsed.get("category") if isinstance(parsed, dict) else None
        if category == "not_found":
            return HealthCheckResult(healthy=True, message="Nylon Pay's API is reachable. This doesn't confirm payouts specifically are enabled — Nylon Pay can pause just that feature while the rest of the API keeps working.")
        return HealthCheckResult(healthy=False, message=_humanize_payout_failure(str(result.error)) or "Nylon Pay's API is not reachable.")
