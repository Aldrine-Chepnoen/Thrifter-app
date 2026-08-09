import requests
from typing import Optional, Dict, Any

from config import settings
from .base import PaymentProvider, InitiateResult, WebhookResult

BASE_URL = "https://api.flutterwave.com/v3"


class FlutterwaveProvider(PaymentProvider):
    name = "flutterwave"

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}",
            "Content-Type": "application/json",
        }

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
        payload = {
            "tx_ref": tx_ref,
            "amount": amount,
            "currency": currency,
            "redirect_url": redirect_url,
            "customer": {
                "email": customer_email,
                "name": customer_name,
                "phonenumber": customer_phone,
            },
            "customizations": {"title": "Thrifter Checkout"},
        }
        resp = requests.post(f"{BASE_URL}/payments", json=payload, headers=self._headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()
        link = (data.get("data") or {}).get("link")
        if not link:
            raise RuntimeError(f"Flutterwave did not return a payment link: {data}")
        return InitiateResult(redirect_url=link, tx_ref=tx_ref)

    def verify(self, tx_ref: str, provider_ref: Optional[str] = None) -> str:
        # Flutterwave's verify-by-id endpoint needs the numeric transaction id, which
        # only becomes known from the redirect callback or webhook — not at initiate time.
        if not provider_ref:
            return "pending"
        resp = requests.get(f"{BASE_URL}/transactions/{provider_ref}/verify", headers=self._headers(), timeout=15)
        resp.raise_for_status()
        data = (resp.json() or {}).get("data") or {}
        if data.get("tx_ref") != tx_ref:
            return "failed"
        status = data.get("status")
        if status == "successful":
            return "successful"
        if status in ("failed", "cancelled"):
            return "failed"
        return "pending"

    def parse_webhook(self, headers: Dict[str, str], data: Dict[str, Any]) -> WebhookResult:
        signature = headers.get("verif-hash")
        valid = bool(signature) and bool(settings.FLUTTERWAVE_SECRET_HASH) and signature == settings.FLUTTERWAVE_SECRET_HASH
        payload_data = data.get("data") or {}
        status_raw = payload_data.get("status")
        if status_raw == "successful":
            status = "successful"
        elif status_raw in ("failed", "cancelled"):
            status = "failed"
        else:
            status = "pending"
        return WebhookResult(
            valid=valid,
            tx_ref=payload_data.get("tx_ref"),
            provider_tx_id=str(payload_data["id"]) if payload_data.get("id") is not None else None,
            status=status,
            raw=data,
        )
