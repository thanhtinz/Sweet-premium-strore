"""Topup Game provider adapter (Shoperis style).

Base URL pattern: {domain}/api/public
Auth: x-api-key header
"""

import logging
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

TIMEOUT = 15


class TopupGameProvider(BaseProvider):
    """Shoperis API adapter."""

    def _headers(self) -> dict:
        return {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0",
        }

    def _url(self, path: str) -> str:
        return f"{self.base_url}/api/public{path}"

    async def _get(self, path: str, params: dict | None = None) -> dict:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(self._url(path), headers=self._headers(), params=params)
            r.raise_for_status()
            return r.json()

    async def _post(self, path: str, body: dict) -> dict:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(self._url(path), headers=self._headers(), json=body)
            r.raise_for_status()
            return r.json()

    # ── Public interface ──────────────────────────────

    async def test_connection(self) -> dict:
        data = await self._get("/balance")
        return {
            "provider_type": "topup_game",
            "balance": data.get("balance", data.get("data", {}).get("balance", 0)),
            "formatted": data.get("formatted", ""),
        }

    async def get_balance(self) -> ProviderBalance:
        data = await self._get("/balance")
        bal = data.get("data", data)
        return ProviderBalance(
            amount=float(bal.get("balance", 0)),
            currency=bal.get("currency", "VND"),
            formatted=bal.get("formatted", ""),
        )

    async def get_products(self, category_id: Optional[str] = None) -> list[ProviderProduct]:
        """Map Shoperis categories → ProviderProduct, products → ProviderPlan."""
        cats_data = await self._get("/categories")
        categories = cats_data.get("data", cats_data)
        if isinstance(categories, dict):
            categories = categories.get("categories", [])

        if category_id:
            categories = [c for c in categories if str(c.get("id", "")) == str(category_id)]

        result = []
        for cat in categories:
            plans = []
            for p in cat.get("products", []):
                plans.append(ProviderPlan(
                    id=str(p.get("id", "")),
                    name=p.get("name", ""),
                    price=float(p.get("price", 0)),
                    sale_price=None,
                    in_stock=p.get("availableCount", 0) > 0,
                    fields=[],
                ))
            result.append(ProviderProduct(
                id=str(cat.get("id", "")),
                name=cat.get("name", ""),
                slug=cat.get("slug", ""),
                image=cat.get("image", ""),
                plans=plans,
            ))

        return result

    async def get_product(self, product_id: str) -> Optional[ProviderProduct]:
        all_products = await self.get_products()
        for p in all_products:
            if p.id == product_id:
                return p
        return None

    async def get_form_fields(self, product_id: str) -> list[dict]:
        """Get formFields from category detail (product_id = category id in Shoperis)."""
        try:
            data = await self._get(f"/categories/{product_id}")
            cat = data.get("data", data)
            raw_fields = cat.get("formFields", [])
            return [
                {
                    "key": f.get("key", ""),
                    "label": f.get("label", ""),
                    "type": "select" if f.get("type") == "SELECT" else "text",
                    "required": f.get("isRequired", True),
                    "options": [opt.get("label", opt.get("value", "")) for opt in f.get("options", [])],
                }
                for f in raw_fields
            ]
        except Exception as e:
            logger.error(f"get_form_fields failed: {e}")
            return []

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
        body: dict = {
            "product_id": product_id,
            "plan_id": plan_id,
            "quantity": quantity,
        }
        if fields_data:
            body["fields"] = fields_data
        try:
            data = await self._post("/purchase", body)
            order = data.get("data", data)
            return ProviderOrderResult(
                order_id=str(order.get("order_id", order.get("id", ""))),
                status=order.get("status", "pending"),
                delivery_data=order.get("delivery_data"),
                message=order.get("message"),
            )
        except Exception as e:
            logger.error(f"TopupGame create_order failed: {e}")
            return ProviderOrderResult(
                order_id="",
                status="failed",
                message=str(e),
            )

    async def get_order_status(self, order_id: str) -> ProviderOrderResult:
        data = await self._get("/orders", {"order_id": order_id})
        orders = data.get("data", data)
        if isinstance(orders, list) and orders:
            order = orders[0]
        elif isinstance(orders, dict):
            order = orders
        else:
            return ProviderOrderResult(order_id=order_id, status="unknown")
        return ProviderOrderResult(
            order_id=str(order.get("id", order_id)),
            status=order.get("status", "unknown"),
            delivery_data=order.get("delivery_data"),
        )
