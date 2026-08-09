import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from config import settings
from .base import PaymentProvider, InitiateResult, WebhookResult


class PesapalProvider(PaymentProvider):
    name = "pesapal"

    def __init__(self):
        self._base_url = (
            "https://pay.pesapal.com/v3"
            if settings.PESAPAL_ENV == "live"
            else "https://cybqa.pesapal.com/pesapalv3"
        )
        self._token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None

    def _get_token(self) -> str:
        if self._token and self._token_expiry and datetime.utcnow() < self._token_expiry:
            return self._token
        resp = requests.post(
            f"{self._base_url}/api/Auth/RequestToken",
            json={"consumer_key": settings.PESAPAL_CONSUMER_KEY, "consumer_secret": settings.PESAPAL_CONSUMER_SECRET},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        token = data.get("token")
        if not token:
            raise RuntimeError(f"Pesapal auth failed: {data}")
        self._token = token
        # Pesapal tokens are valid 5 minutes; refresh a little early to be safe.
        self._token_expiry = datetime.utcnow() + timedelta(minutes=4)
        return token

    def _headers(self) -> Dict[str, str]:
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._get_token()}",
        }

    def register_ipn(self, ipn_url: str) -> str:
        """One-time setup call — register the webhook URL and get back an ipn_id
        to store as PESAPAL_IPN_ID. Not called on the request path."""
        resp = requests.post(
            f"{self._base_url}/api/URLSetup/RegisterIPN",
            json={"url": ipn_url, "ipn_notification_type": "GET"},
            headers=self._headers(),
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        ipn_id = data.get("ipn_id")
        if not ipn_id:
            raise RuntimeError(f"Pesapal IPN registration failed: {data}")
        return ipn_id

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
        if not settings.PESAPAL_IPN_ID:
            raise RuntimeError("PESAPAL_IPN_ID is not configured — register an IPN URL first")
        first_name, _, last_name = customer_name.partition(" ")
        payload = {
            "id": tx_ref,
            "currency": currency,
            "amount": amount,
            "description": "Thrifter order",
            "callback_url": redirect_url,
            "notification_id": settings.PESAPAL_IPN_ID,
            "billing_address": {
                "email_address": customer_email,
                "phone_number": customer_phone,
                "first_name": first_name or customer_name,
                "last_name": last_name or first_name or customer_name,
            },
        }
        resp = requests.post(
            f"{self._base_url}/api/Transactions/SubmitOrderRequest",
            json=payload,
            headers=self._headers(),
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        redirect = data.get("redirect_url")
        tracking_id = data.get("order_tracking_id")
        if not redirect or not tracking_id:
            raise RuntimeError(f"Pesapal order submission failed: {data}")
        return InitiateResult(redirect_url=redirect, tx_ref=tx_ref, provider_ref=tracking_id)

    def verify(self, tx_ref: str, provider_ref: Optional[str] = None) -> str:
        # Pesapal explicitly does not put payment status in the callback/IPN payload
        # "for security reasons" — GetTransactionStatus is the only trustworthy source.
        if not provider_ref:
            return "pending"
        resp = requests.get(
            f"{self._base_url}/api/Transactions/GetTransactionStatus",
            params={"orderTrackingId": provider_ref},
            headers=self._headers(),
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        desc = (data.get("payment_status_description") or "").upper()
        if desc == "COMPLETED":
            return "successful"
        if desc in ("FAILED", "INVALID", "REVERSED"):
            return "failed"
        return "pending"

    def parse_webhook(self, headers: Dict[str, str], data: Dict[str, Any]) -> WebhookResult:
        # Registered as a GET IPN, so `data` here is the query-string params Pesapal
        # calls back with, not a JSON body. There is no signature to check — trust is
        # established purely by immediately re-querying GetTransactionStatus below.
        tracking_id = data.get("OrderTrackingId") or data.get("orderTrackingId")
        merchant_ref = data.get("OrderMerchantReference") or data.get("orderMerchantReference")
        status = self.verify(merchant_ref, provider_ref=tracking_id) if tracking_id else "pending"
        return WebhookResult(
            valid=bool(tracking_id),
            tx_ref=merchant_ref,
            provider_tx_id=tracking_id,
            status=status,
            raw=data,
        )
