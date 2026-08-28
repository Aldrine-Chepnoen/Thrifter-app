from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, Any


@dataclass
class InitiateResult:
    redirect_url: str
    tx_ref: str
    # Provider-side reference needed to later verify/poll status. Not all
    # providers need one up front.
    provider_ref: Optional[str] = None


@dataclass
class WebhookResult:
    valid: bool
    tx_ref: Optional[str]
    provider_tx_id: Optional[str]
    status: str  # "successful" | "failed" | "pending"
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PayoutResult:
    success: bool
    status: str  # "successful" | "failed" | "pending"
    provider_ref: Optional[str] = None
    failure_reason: Optional[str] = None


class PaymentProvider(ABC):
    name: str

    @abstractmethod
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
        """Start a hosted checkout session, returning the URL to redirect the buyer to."""
        ...

    @abstractmethod
    def verify(self, tx_ref: str, provider_ref: Optional[str] = None) -> str:
        """Re-query the provider directly. Returns 'successful' | 'failed' | 'pending'."""
        ...

    @abstractmethod
    def parse_webhook(self, headers: Dict[str, str], data: Dict[str, Any]) -> WebhookResult:
        """Interpret an inbound webhook call. `data` is the JSON body for
        providers that POST a payload."""
        ...

    @abstractmethod
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
        """Send money out. Blocks until the provider reports a terminal
        status — payouts here are low-frequency, admin-triggered actions,
        so synchronous resolution is acceptable (unlike collect_payment,
        which stays async via webhook for buyer-facing collection)."""
        ...
