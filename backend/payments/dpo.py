import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional, Dict, Any

from config import settings
from .base import PaymentProvider, InitiateResult, WebhookResult

API_URL = "https://secure.3gdirectpay.com/API/v6/"
HOSTED_PAGE_URL = "https://secure.3gdirectpay.com/payv3.php"

# DPO's own success code from createToken/verifyToken responses.
RESULT_PAID = "000"
RESULT_PENDING = {"001", "003", "005", "900"}
RESULT_FAILED = {"901", "903", "904"}

# DPO's edge blocks requests carrying the default python-requests User-Agent (403),
# so every call needs a normal-looking one.
_REQUEST_HEADERS = {"Content-Type": "text/xml", "User-Agent": "Mozilla/5.0 (Thrifter payment integration)"}


def _xml_to_dict(xml_text: str) -> Dict[str, str]:
    """Flattens the top-level children of DPO's <API3G>...</API3G> response into a dict."""
    root = ET.fromstring(xml_text)
    return {child.tag: (child.text or "").strip() for child in root}


def _dict_to_api3g_xml(fields: Dict[str, Any]) -> str:
    root = ET.Element("API3G")
    for key, value in fields.items():
        if isinstance(value, dict):
            parent = ET.SubElement(root, key)
            for k2, v2 in value.items():
                if isinstance(v2, list):
                    for item in v2:
                        child = ET.SubElement(parent, k2)
                        for k3, v3 in item.items():
                            ET.SubElement(child, k3).text = str(v3)
                else:
                    ET.SubElement(parent, k2).text = str(v2)
        else:
            ET.SubElement(root, key).text = str(value)
    return '<?xml version="1.0" encoding="utf-8"?>' + ET.tostring(root, encoding="unicode")


class DpoProvider(PaymentProvider):
    name = "dpo"

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
        first_name, _, last_name = customer_name.partition(" ")
        body = _dict_to_api3g_xml({
            "CompanyToken": settings.DPO_COMPANY_TOKEN,
            "Request": "createToken",
            "Transaction": {
                "PaymentAmount": f"{amount:.2f}",
                "PaymentCurrency": currency,
                "CompanyRef": tx_ref,
                "RedirectURL": redirect_url,
                "BackURL": redirect_url,
                "customerEmail": customer_email,
                "customerFirstName": first_name or customer_name,
                "customerLastName": last_name or first_name or customer_name,
                "customerPhone": customer_phone,
            },
            "Services": {
                "Service": [{
                    "ServiceType": settings.DPO_SERVICE_TYPE,
                    "ServiceDescription": "Thrifter order",
                    "ServiceDate": datetime.utcnow().strftime("%Y/%m/%d %H:%M"),
                }]
            },
        })
        resp = requests.post(API_URL, data=body.encode("utf-8"), headers=_REQUEST_HEADERS, timeout=15)
        resp.raise_for_status()
        data = _xml_to_dict(resp.text)
        trans_token = data.get("TransToken")
        if not trans_token:
            # createToken reuses "000" to mean "request OK" (not "paid" — that
            # meaning is specific to verifyToken) — a missing token is the real signal.
            raise RuntimeError(f"DPO createToken failed: {data}")
        return InitiateResult(
            redirect_url=f"{HOSTED_PAGE_URL}?ID={trans_token}",
            tx_ref=tx_ref,
            provider_ref=trans_token,
        )

    def verify(self, tx_ref: str, provider_ref: Optional[str] = None) -> str:
        if not provider_ref:
            return "pending"
        body = _dict_to_api3g_xml({
            "CompanyToken": settings.DPO_COMPANY_TOKEN,
            "Request": "verifyToken",
            "TransactionToken": provider_ref,
        })
        resp = requests.post(API_URL, data=body.encode("utf-8"), headers=_REQUEST_HEADERS, timeout=15)
        resp.raise_for_status()
        data = _xml_to_dict(resp.text)
        result = data.get("Result")
        if result == RESULT_PAID:
            return "successful"
        if result in RESULT_FAILED:
            return "failed"
        return "pending"

    def parse_webhook(self, headers: Dict[str, str], data: Dict[str, Any]) -> WebhookResult:
        # DPO's push notification carries no signature — trust is established by
        # immediately re-verifying via verifyToken below, same as Pesapal.
        trans_token = data.get("TransactionToken")
        tx_ref = data.get("CompanyRef")
        status = self.verify(tx_ref, provider_ref=trans_token) if trans_token else "pending"
        return WebhookResult(
            valid=bool(trans_token),
            tx_ref=tx_ref,
            provider_tx_id=trans_token,
            status=status,
            raw=data,
        )
