"""SMM Panel provider adapter.

Protocol: smmresell.com style (v2)
Auth: API Key sent in POST body
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


class SmmPanelProvider(BaseProvider):
    """SMM Panel API adapter (v2)."""

    def _url(self) -> str:
        return f"{self.base_url}/api/v2"

    async def _post(self, action: str, **params) -> dict | list:
        payload = {"key": self.api_key, "action": action, **params}
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(self._url(), data=payload)
            r.raise_for_status()
            return r.json()

    # ── Public interface ──────────────────────────────

    async def test_connection(self) -> dict:
        data = await self._post("balance")
        if "error" in data:
            raise ValueError(data["error"])
        return {
            "provider_type": "smm_panel",
            "balance": data.get("balance", 0),
            "currency": data.get("currency", "USD"),
        }

    async def get_balance(self) -> ProviderBalance:
        data = await self._post("balance")
        if "error" in data:
            raise ValueError(data["error"])
        return ProviderBalance(
            amount=float(data.get("balance", 0)),
            currency=data.get("currency", "USD"),
            formatted=f"{data.get('balance', 0)} {data.get('currency', 'USD')}",
        )

    async def get_products(self, category_id: Optional[str] = None) -> list[ProviderProduct]:
        """SMM services API doesn't perfectly map to ProviderProduct. We'll return empty here and use a custom sync."""
        return []

    async def get_product(self, product_id: str) -> Optional[ProviderProduct]:
        return None

    async def get_plans(self, product_id: str) -> list[ProviderPlan]:
        return []

    async def create_order(
        self,
        product_id: str,
        plan_id: str,
        quantity: int = 1,
        fields_data: Optional[dict] = None,
    ) -> ProviderOrderResult:
        # For SMM, product_id is irrelevant, plan_id = service_id
        link = fields_data.get("link") if fields_data else ""
        try:
            data = await self._post("add", service=plan_id, link=link, quantity=quantity)
            if "error" in data:
                return ProviderOrderResult(order_id="", status="failed", message=data["error"])
            return ProviderOrderResult(
                order_id=str(data.get("order", "")),
                status="pending",
                message="Order added"
            )
        except Exception as e:
            logger.error(f"SmmPanel create_order failed: {e}")
            return ProviderOrderResult(order_id="", status="failed", message=str(e))

    async def get_order_status(self, order_id: str) -> ProviderOrderResult:
        try:
            data = await self._post("status", order=order_id)
            if "error" in data:
                return ProviderOrderResult(order_id=order_id, status="unknown", message=data["error"])
            
            # map status
            # SMM statuses: Pending, Processing, In progress, Completed, Partial, Canceled
            raw_status = data.get("status", "").lower()
            internal_status = "pending"
            if raw_status in ["completed"]: internal_status = "completed"
            elif raw_status in ["processing", "in progress"]: internal_status = "processing"
            elif raw_status in ["partial"]: internal_status = "partial"
            elif raw_status in ["canceled", "cancelled"]: internal_status = "canceled"

            return ProviderOrderResult(
                order_id=order_id,
                status=internal_status,
                delivery_data=None,
                message=f"start_count: {data.get('start_count', '0')}, remains: {data.get('remains', '0')}"
            )
        except Exception as e:
            logger.error(f"SmmPanel get_order_status failed: {e}")
            return ProviderOrderResult(order_id=order_id, status="unknown", message=str(e))

    # ── SMM Specific interface ────────────────────────

    async def get_services(self) -> list[dict]:
        """Fetch all services from SMM panel."""
        data = await self._post("services")
        if isinstance(data, dict) and "error" in data:
            raise ValueError(data["error"])
        return data  # Should be list of service dicts

    async def create_refill(self, order_id: str) -> dict:
        data = await self._post("refill", order=order_id)
        return data

    async def get_refill_status(self, refill_id: str) -> dict:
        data = await self._post("refill_status", refill=refill_id)
        return data