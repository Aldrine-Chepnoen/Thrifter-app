from typing import Optional, Dict, Any

from nylonpay import create_nylon_pay, SdkException, VerifyWebhookInput, verify_webhook_signature

from config import settings
from .base import PaymentProvider, InitiateResult, WebhookResult


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
        try:
            client.collect_payment(
                amount=int(round(amount)),
                currency=currency,
                customer={"name": customer_name, "phone_number": customer_phone, "email": customer_email or None},
                description="Thrifter order",
                reference=tx_ref,
            )
        except SdkException as e:
            raise RuntimeError(f"Nylon Pay collection failed [{e.category}]: {e}") from e
        # Mobile money collections have no hosted checkout page — the customer approves
        # on their own phone. Send the buyer straight to our confirmation page, which
        # already polls GET /checkout/{id} until the webhook (or verify()) resolves it.
        return InitiateResult(redirect_url=redirect_url, tx_ref=tx_ref, provider_ref=None)

    def verify(self, tx_ref: str, provider_ref: Optional[str] = None) -> str:
        result = self._get_client().get_status(reference=tx_ref)
        if not result.is_ok:
            return "pending"
        status = result.value.status
        if status == "successful":
            return "successful"
        if status in ("failed", "cancelled"):
            return "failed"
        return "pending"  # pending, processing, on_hold

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
        payload = data.get("payload", {}) if valid else {}
        status_map = {"successful": "successful", "failed": "failed", "cancelled": "failed"}
        return WebhookResult(
            valid=valid,
            tx_ref=payload.get("reference"),
            provider_tx_id=payload.get("transactionId"),
            status=status_map.get(payload.get("status"), "pending"),
            raw=data,
        )
