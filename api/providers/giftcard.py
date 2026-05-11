"""Giftcard provider adapter (Thesieure / chargingws/v2 protocol).

Base URL: domain (e.g. https://thesieure.com)
Auth: partner_id + partner_key
Sign: md5(partner_key + code + command + partner_id + request_id + serial + telco)
Endpoint: POST {base_url}/chargingws/v2  (form data)

Status codes:
  1  = thẻ đúng mệnh giá
  2  = thẻ sai mệnh giá
  3  = thẻ lỗi
  4  = hệ thống bảo trì
  99 = chờ xử lý
  100 = gửi thất bại
"""

import hashlib
import logging
import uuid
from typing import Optional

import httpx

from api.providers import (
    BaseProvider,
    ProviderBalance,
    ProviderOrderResult,
    ProviderPlan,
    ProviderProduct,
)

logger = logging.getLogger(__name__)

TIMEOUT = 20

# Default telcos and denominations
DEFAULT_TELCOS = ["VIETTEL", "VINAPHONE", "MOBIFONE", "VNMOBI"]
DEFAULT_AMOUNTS = [10000, 20000, 50000, 100000, 200000, 500000, 1000000]


class GiftcardProvider(BaseProvider):
    """Thesieure / chargingws/v2 adapter.

    api_key    = partner_key (secret used for signing)
    partner_id = partner_id  (public identifier)
    """

    def __init__(self, base_url: str, api_key: str, api_secret: str | None = None, partner_id: str | None = None):
        super().__init__(base_url, api_key, api_secret)
        # partner_key stored in api_secret; partner_id stored separately
        self.partner_id = partner_id or ""
        self.partner_key = api_secret or api_key  # fallback

    def _sign(self, **kw) -> str:
        """Generate md5 sign: md5(partner_key + code + command + partner_id + request_id + serial + telco)."""
        parts = [
            self.partner_key,
            kw.get("code", ""),
            kw.get("command", ""),
            self.partner_id,
            kw.get("request_id", ""),
            kw.get("serial", ""),
            kw.get("telco", ""),
        ]
        raw = "".join(str(p) for p in parts)
        return hashlib.md5(raw.encode()).hexdigest()

    def _callback_sign(self, code: str, serial: str) -> str:
        """Verify callback: md5(partner_key + code + serial)."""
        raw = f"{self.partner_key}{code}{serial}"
        return hashlib.md5(raw.encode()).hexdigest()

    def _url(self, path: str = "/chargingws/v2") -> str:
        return f"{self.base_url}{path}"

    async def _post_form(self, data: dict) -> dict:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                self._url(),
                data=data,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json",
                },
            )
            r.raise_for_status()
            return r.json()

    # ── Card charging (đổi thẻ) ──────────────────────

    async def charge_card(
        self,
        telco: str,
        code: str,
        serial: str,
        amount: int,
        request_id: str,
    ) -> dict:
        """Send card for charging (đổi thẻ). Returns raw API response."""
        sign = self._sign(
            code=code, command="charging",
            request_id=request_id, serial=serial, telco=telco,
        )
        data = {
            "telco": telco,
            "code": code,
            "serial": serial,
            "amount": amount,
            "request_id": request_id,
            "partner_id": self.partner_id,
            "sign": sign,
            "command": "charging",
        }
        try:
            result = await self._post_form(data)
            logger.info(f"charge_card response: {result}")
            return result
        except Exception as e:
            logger.error(f"charge_card failed: {e}")
            return {"status": 100, "message": str(e)}

    async def check_card_status(
        self,
        telco: str,
        code: str,
        serial: str,
        amount: int,
        request_id: str,
    ) -> dict:
        """Check card status (command=check)."""
        sign = self._sign(
            code=code, command="check",
            request_id=request_id, serial=serial, telco=telco,
        )
        data = {
            "telco": telco,
            "code": code,
            "serial": serial,
            "amount": amount,
            "request_id": request_id,
            "partner_id": self.partner_id,
            "sign": sign,
            "command": "check",
        }
        return await self._post_form(data)

    def verify_callback_sign(self, code: str, serial: str, received_sign: str) -> bool:
        """Verify callback_sign from provider."""
        expected = self._callback_sign(code, serial)
        return expected == received_sign

    # ── Buy card (mua thẻ) ───────────────────────────

    async def buy_card(self, telco: str, amount: int, quantity: int = 1) -> dict:
        """Buy card codes. Endpoint may vary per provider — default /buycard."""
        data = {
            "telco": telco,
            "amount": amount,
            "quantity": quantity,
            "partner_id": self.partner_id,
        }
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                r = await client.post(
                    self._url("/buycard"),
                    data=data,
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "Mozilla/5.0",
                        "Accept": "application/json",
                    },
                )
                r.raise_for_status()
                return r.json()
        except Exception as e:
            logger.error(f"buy_card failed: {e}")
            return {"status": 0, "message": str(e)}

    # ── BaseProvider interface ────────────────────────

    async def test_connection(self) -> dict:
        """Test by sending a check command with dummy data — validates auth."""
        try:
            # Try a simple check request to verify credentials
            result = await self.check_card_status(
                telco="VIETTEL", code="000000000000000",
                serial="00000000000000", amount=10000,
                request_id=f"test_{uuid.uuid4().hex[:8]}",
            )
            # Status 100 (send failed) with a message means auth works but card is invalid = OK
            # Status 4 = maintenance = connection works
            return {
                "provider_type": "giftcard",
                "status": result.get("status"),
                "message": result.get("message", ""),
                "connected": result.get("status") in [3, 4, 99, 100],
            }
        except Exception as e:
            return {"provider_type": "giftcard", "connected": False, "message": str(e)}

    async def get_balance(self) -> ProviderBalance:
        """Thesieure doesn't have a standard balance endpoint.
        Return empty balance — override if provider supports it."""
        return ProviderBalance(amount=0, currency="VND", formatted="N/A")

    async def get_products(self, category_id: Optional[str] = None) -> list[ProviderProduct]:
        """Return telcos as products, denominations as plans."""
        products = []
        for telco in DEFAULT_TELCOS:
            plans = [
                ProviderPlan(
                    id=f"{telco}_{amt}",
                    name=f"{amt:,}đ".replace(",", "."),
                    price=float(amt),
                )
                for amt in DEFAULT_AMOUNTS
            ]
            products.append(ProviderProduct(
                id=telco,
                name=telco,
                slug=telco.lower(),
                plans=plans,
            ))
        return products

    async def get_product(self, product_id: str) -> Optional[ProviderProduct]:
        products = await self.get_products()
        return next((p for p in products if p.id == product_id), None)

    async def get_plans(self, product_id: str) -> list[ProviderPlan]:
        product = await self.get_product(product_id)
        return product.plans if product else []

    async def create_order(
        self,
        product_id: str,
        plan_id: str,
        quantity: int = 1,
        fields_data: Optional[dict] = None,
    ) -> ProviderOrderResult:
        """Buy a card — product_id=telco, plan_id=telco_amount."""
        telco = product_id
        amount = int(plan_id.split("_")[-1]) if "_" in plan_id else int(plan_id)
        try:
            result = await self.buy_card(telco, amount, quantity)
            status_code = result.get("Code", result.get("status", 0))
            if status_code == 1:
                cards = result.get("Data", result.get("data", []))
                if isinstance(cards, list) and cards:
                    card = cards[0]
                    delivery = f"Nhà mạng: {card.get('Telco', telco)}\nMã thẻ: {card.get('Pin', card.get('code', ''))}\nSerial: {card.get('Serial', card.get('serial', ''))}\nMệnh giá: {card.get('Amount', amount)}"
                    return ProviderOrderResult(
                        order_id=str(result.get("trans_id", uuid.uuid4().hex[:8])),
                        status="completed",
                        delivery_data=delivery,
                        message=result.get("Message", result.get("message", "")),
                    )
            return ProviderOrderResult(
                order_id="",
                status="failed",
                message=result.get("Message", result.get("message", "Mua thẻ thất bại")),
            )
        except Exception as e:
            logger.error(f"create_order (giftcard buy) failed: {e}")
            return ProviderOrderResult(order_id="", status="failed", message=str(e))

    async def get_order_status(self, order_id: str) -> ProviderOrderResult:
        return ProviderOrderResult(order_id=order_id, status="unknown", message="Not supported")
