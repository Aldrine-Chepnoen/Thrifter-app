from .base import PaymentProvider
from .pesapal import PesapalProvider
from .nylon import NylonPayProvider

# Flutterwave and DPO were dropped (Flutterwave KYC stalled, DPO never went live).
_PROVIDERS = {
    "pesapal": PesapalProvider,
    "nylon": NylonPayProvider,
}


def get_provider(name: str) -> PaymentProvider:
    cls = _PROVIDERS.get(name)
    if not cls:
        raise ValueError(f"Unknown payment provider: {name}")
    return cls()
