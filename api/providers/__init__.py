"""External API provider adapters.

Protocol templates are hardcoded — each shop only needs domain + credentials.
Three provider types:
  - account_premium (ShopKey/CMSNT): X-API-Key + X-API-Secret
  - topup_game (Shoperis): Bearer token
  - giftcard (Thesieure/chargingws/v2): partner_id + partner_key, md5 sign
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ProviderPlan:
    id: str
    name: str
    price: float
    sale_price: Optional[float] = None
    in_stock: bool = True
    fields: list[dict] = field(default_factory=list)  # [{key, label, type, required}]


@dataclass
class ProviderProduct:
    id: str
    name: str
    slug: str = ""
    image: str = ""
    plans: list[ProviderPlan] = field(default_factory=list)


@dataclass
class ProviderOrderResult:
    order_id: str
    status: str  # pending | completed | failed
    delivery_data: Optional[str] = None
    message: Optional[str] = None


@dataclass
class ProviderBalance:
    amount: float
    currency: str = "VND"
    formatted: str = ""


class BaseProvider(ABC):
    """Abstract base for external API providers."""

    def __init__(self, base_url: str, api_key: str, api_secret: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.api_secret = api_secret

    @abstractmethod
    async def test_connection(self) -> dict:
        """Test connection, return provider info / balance."""
        ...

    @abstractmethod
    async def get_balance(self) -> ProviderBalance:
        ...

    @abstractmethod
    async def get_products(self, category_id: Optional[str] = None) -> list[ProviderProduct]:
        ...

    @abstractmethod
    async def get_product(self, product_id: str) -> Optional[ProviderProduct]:
        ...

    @abstractmethod
    async def get_plans(self, product_id: str) -> list[ProviderPlan]:
        """Get plans for a specific product (with fields)."""
        ...

    @abstractmethod
    async def create_order(
        self,
        product_id: str,
        plan_id: str,
        quantity: int = 1,
        fields_data: Optional[dict] = None,
    ) -> ProviderOrderResult:
        ...

    @abstractmethod
    async def get_order_status(self, order_id: str) -> ProviderOrderResult:
        ...

    async def get_form_fields(self, product_id: str) -> list[dict]:
        """Get custom form fields for a product. Override in subclass if supported."""
        return []

    # ── Giftcard-specific (override in giftcard adapter) ──────────

    async def charge_card(
        self, telco: str, code: str, serial: str, amount: int, request_id: str
    ) -> dict:
        """Submit scratch card for charging. Returns API response dict."""
        raise NotImplementedError("charge_card not supported by this provider")

    async def check_card_status(
        self, telco: str, code: str, serial: str, amount: int, request_id: str
    ) -> dict:
        """Check status of a previously submitted card charge."""
        raise NotImplementedError("check_card_status not supported by this provider")

    async def buy_card(self, telco: str, amount: int, quantity: int = 1) -> dict:
        """Buy gift cards from provider. Returns API response with code/serial."""
        raise NotImplementedError("buy_card not supported by this provider")

    def verify_callback_sign(self, code: str, serial: str, received_sign: str) -> bool:
        """Verify callback signature from provider."""
        raise NotImplementedError("verify_callback_sign not supported by this provider")


def get_provider(provider_row) -> BaseProvider:
    """Factory: create provider adapter from DB row."""
    from api.providers.account_premium import AccountPremiumProvider
    from api.providers.topup_game import TopupGameProvider
    from api.providers.giftcard import GiftcardProvider

    t = provider_row.provider_type
    if t == "account_premium":
        return AccountPremiumProvider(
            base_url=provider_row.base_url,
            api_key=provider_row.api_key,
            api_secret=provider_row.api_secret,
        )
    elif t == "topup_game":
        return TopupGameProvider(
            base_url=provider_row.base_url,
            api_key=provider_row.api_key,
        )
    elif t == "giftcard":
        return GiftcardProvider(
            base_url=provider_row.base_url,
            api_key=provider_row.api_key,
            api_secret=provider_row.api_secret,
            partner_id=provider_row.partner_id,
        )
    else:
        raise ValueError(f"Unknown provider type: {t}")
