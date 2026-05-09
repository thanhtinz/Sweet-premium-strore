from decimal import Decimal
from typing import Optional

from fastapi import Query, Request
from pydantic import BaseModel

from db.models import BalanceTransaction

MIN_TOPUP = 10_000
MAX_TOPUP = 10_000_000
TOPUP_STEP = 1_000


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _txn_to_dict(t: BalanceTransaction) -> dict:
    return {
        "id": t.id,
        "user_id": t.user_id,
        "amount": float(t.amount),
        "balance_after": float(t.balance_after),
        "type": t.type,
        "status": t.status,
        "reference": t.reference,
        "description": t.description,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


class TopupRequest(BaseModel):
    amount: int


class WithdrawRequest(BaseModel):
    amount: Optional[int] = None


class AdminAdjustRequest(BaseModel):
    user_id: int
    amount: int
    description: str = ""
