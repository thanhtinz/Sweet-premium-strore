"""Account Premium provider adapter (ShopKey / CMSNT style).

Base URL pattern: {domain}/api/v1
Auth: X-API-Key + X-API-Secret headers
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


class AccountPremiumProvider(BaseProvider):
    """ShopKey / CMSNT API adapter."""

    def _headers(self) -> dict:
        h = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }
        if self.api_secret:
            h["X-API-Secret"] = self.api_secret
        return h

    def _url(self, path: str) -> str:
        return f"{self.base_url}/api/v1{path}"

    async def _get(self, path: str, params: dict | None = None) -> dict:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(self._url(path), headers=self._headers(), params=params)
            r.raise_for_status()
            data = r.json()
            if not data.get("success"):
                raise Exception(data.get("message", "API error"))
            return data.get("data", {})

    async def _post(self, path: str, body: dict) -> dict:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(self._url(path), headers=self._headers(), json=body)
            r.raise_for_status()
            data = r.json()
            if not data.get("success"):
                raise Exception(data.get("message", "API error"))
            return data.get("data", {})

    # ── Public interface ──────────────────────────────

    async def test_connection(self) -> dict:
        data = await self._get("/account/info")
        user = data.get("user", {})
        balance = data.get("balance", data)
        return {
            "provider_type": "account_premium",
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "balance": balance.get("current", balance.get("balance", 0)),
            "formatted": balance.get("formatted", ""),
        }

    async def get_balance(self) -> ProviderBalance:
        data = await self._get("/account/balance")
        bal = data.get("balance", data)
        return ProviderBalance(
            amount=float(bal.get("current", bal.get("balance", 0))),
            currency=bal.get("currency", "VND"),
            formatted=bal.get("formatted", ""),
        )

    async def get_products(self, category_id: Optional[str] = None) -> list[ProviderProduct]:
        products = []
        page = 1
        while True:
            params = {"page": page, "limit": 100}
            if category_id:
                params["category_id"] = category_id
            data = await self._get("/products/list", params)
            for p in data.get("products", []):
                plans = []
                for pl in p.get("plans", []):
                    fields = [
                        {
                            "key": f.get("key", f.get("field_name", "")),
                            "label": f.get("label", f.get("field_name", "")),
                            "type": f.get("type", "text"),
                            "required": f.get("required", True),
                        }
                        for f in pl.get("fields", [])
                    ]
                    plans.append(ProviderPlan(
                        id=str(pl["id"]),
                        name=pl.get("name", ""),
                        price=float(pl.get("final_price", pl.get("price", 0))),
                        sale_price=float(pl["sale_price"]) if pl.get("sale_price") else None,
                        in_stock=pl.get("in_stock", True),
                        fields=fields,
                    ))
                products.append(ProviderProduct(
                    id=str(p["id"]),
                    name=p.get("name", ""),
                    slug=p.get("slug", ""),
                    image=p.get("image", ""),
                    plans=plans,
                ))
            pagination = data.get("pagination", {})
            if not pagination.get("has_more", False):
                break
            page += 1
            if page > 50:  # safety
                break
        return products

    async def get_product(self, product_id: str) -> Optional[ProviderProduct]:
        # ShopKey doesn't have single product endpoint, search from list
        all_products = await self.get_products()
        for p in all_products:
            if p.id == product_id:
                return p
        return None

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
            "product_id": int(product_id),
            "plan_id": int(plan_id),
            "quantity": quantity,
        }
        if fields_data:
            body["fields"] = fields_data
        try:
            data = await self._post("/orders/create", body)
            order = data.get("order", data)
            return ProviderOrderResult(
                order_id=str(order.get("trans_id", order.get("id", ""))),
                status=order.get("status", "pending"),
                delivery_data=order.get("delivery_data"),
                message=order.get("message"),
            )
        except Exception as e:
            logger.error(f"AccountPremium create_order failed: {e}")
            return ProviderOrderResult(
                order_id="",
                status="failed",
                message=str(e),
            )

    async def get_order_status(self, order_id: str) -> ProviderOrderResult:
        data = await self._get("/orders/status", {"trans_id": order_id})
        order = data.get("order", data)
        return ProviderOrderResult(
            order_id=str(order.get("trans_id", order.get("id", order_id))),
            status=order.get("status", "unknown"),
            delivery_data=order.get("delivery_data"),
        )
