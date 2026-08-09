from .base import PaymentProvider
from .flutterwave import FlutterwaveProvider
from .pesapal import PesapalProvider
from .dpo import DpoProvider

_PROVIDERS = {
    "flutterwave": FlutterwaveProvider,
    "pesapal": PesapalProvider,
    "dpo": DpoProvider,
}


def get_provider(name: str) -> PaymentProvider:
    cls = _PROVIDERS.get(name)
    if not cls:
        raise ValueError(f"Unknown payment provider: {name}")
    return cls()
