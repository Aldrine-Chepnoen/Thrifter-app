from .base import PaymentProvider
from .nylon import NylonPayProvider

# Flutterwave, DPO, and Pesapal were dropped (Flutterwave KYC stalled, DPO never
# went live, Pesapal was replaced by Nylon Pay as the sole provider).
_PROVIDERS = {
    "nylon": NylonPayProvider,
}


def get_provider(name: str) -> PaymentProvider:
    cls = _PROVIDERS.get(name)
    if not cls:
        raise ValueError(f"Unknown payment provider: {name}")
    return cls()
