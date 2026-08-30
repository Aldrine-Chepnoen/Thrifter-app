import uuid
from typing import Optional, Dict, Any

from nylonpay import create_nylon_pay, SdkException, VerifyWebhookInput, verify_webhook_signature, Customer, Destination

from config import settings
from .base import PaymentProvider, InitiateResult, WebhookResult, PayoutResult, VerifyResult


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
            return VerifyResult(status="failed", failure_reason=result.value.status_text)
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
            failure_reason=payload.get("failureReason"),
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
            return PayoutResult(success=False, status="failed", failure_reason=f"[{e.category}] {e}")

        if result.is_err:
            return PayoutResult(success=False, status="failed", failure_reason=str(result.error))

        txn = result.value
        if txn.status == "successful":
            return PayoutResult(success=True, status="successful", provider_ref=txn.id)
        return PayoutResult(success=False, status=txn.status, provider_ref=txn.id, failure_reason=txn.failure_reason)
