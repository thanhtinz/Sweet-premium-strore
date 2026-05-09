"""User API Keys — CRUD, domain validation, admin management."""

import hashlib
import secrets
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_current_user, get_current_admin
from api.feature_guard import require_feature
from db import get_db
from db.models import ApiKey, User

_api_docs_on = Depends(require_feature("api_docs"))

router = APIRouter(prefix="/api-keys", tags=["api-keys"], dependencies=[_api_docs_on])

KEY_PREFIX = "sk_live_"
MAX_KEYS_PER_USER = 5


def _generate_key() -> str:
    return KEY_PREFIX + secrets.token_hex(20)


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _key_display_prefix(raw_key: str) -> str:
    return raw_key[:12]


def _parse_domains(raw: str | None) -> list[str]:
    """Parse comma-separated domain list, normalize."""
    if not raw:
        return []
    domains = []
    for d in raw.split(","):
        d = d.strip().lower()
        if d:
            # Strip protocol if user pasted full URL
            if "://" in d:
                d = urlparse(d).hostname or d
            # Remove trailing slashes/paths
            d = d.split("/")[0]
            if d and d not in domains:
                domains.append(d)
    return domains


def _serialize_domains(domains: list[str]) -> str:
    return ",".join(domains)


def _validate_origin(request: Request, key_obj: ApiKey) -> bool:
    """Check if request origin/referer matches allowed domains. Empty = allow all."""
    allowed = _parse_domains(key_obj.allowed_domains)
    if not allowed:
        return True  # No restriction

    origin = request.headers.get("origin", "")
    referer = request.headers.get("referer", "")

    for header_val in [origin, referer]:
        if not header_val:
            continue
        try:
            host = urlparse(header_val).hostname or ""
            host = host.lower()
            for domain in allowed:
                if host == domain or host.endswith("." + domain):
                    return True
        except Exception:
            continue

    # Server-to-server calls (no origin/referer) — allow if from non-browser
    if not origin and not referer:
        return True

    return False


def _key_to_dict(k: ApiKey, *, show_user: bool = False) -> dict:
    d = {
        "id": k.id,
        "name": k.name,
        "key_prefix": k.key_prefix + "••••••••",
        "allowed_domains": _parse_domains(k.allowed_domains),
        "callback_url": k.callback_url or "",
        "is_active": k.is_active,
        "created_at": k.created_at.isoformat() if k.created_at else None,
        "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
    }
    if show_user:
        d["user_id"] = k.user_id
    return d


# ── Request Models ─────────────────────────────────────

class CreateKeyRequest(BaseModel):
    name: str
    allowed_domains: str = ""    # comma-separated
    callback_url: str = ""


class UpdateKeyRequest(BaseModel):
    name: str | None = None
    allowed_domains: str | None = None
    callback_url: str | None = None


# ── User Routes ────────────────────────────────────────

@router.get("/")
def list_keys(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keys = (
        db.query(ApiKey)
        .filter(ApiKey.user_id == user["user_id"])
        .order_by(ApiKey.created_at.desc())
        .all()
    )
    return [_key_to_dict(k) for k in keys]


@router.post("/")
def create_key(
    body: CreateKeyRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Tên key không được trống")

    # Validate domains
    domains = _parse_domains(body.allowed_domains)
    if not domains:
        raise HTTPException(400, "Phải nhập ít nhất 1 domain được phép (VD: example.com)")

    # Validate callback URL
    callback = body.callback_url.strip()
    if callback:
        parsed = urlparse(callback)
        if not parsed.scheme or not parsed.hostname:
            raise HTTPException(400, "Callback URL không hợp lệ. VD: https://example.com/callback")
        # Check callback domain is in allowed domains
        cb_host = parsed.hostname.lower()
        if not any(cb_host == d or cb_host.endswith("." + d) for d in domains):
            raise HTTPException(400, f"Domain của callback URL ({cb_host}) phải nằm trong danh sách domain được phép")

    count = db.query(ApiKey).filter(
        ApiKey.user_id == user["user_id"],
        ApiKey.is_active == True,
    ).count()
    if count >= MAX_KEYS_PER_USER:
        raise HTTPException(400, f"Tối đa {MAX_KEYS_PER_USER} key đang hoạt động")

    raw_key = _generate_key()
    key_obj = ApiKey(
        user_id=user["user_id"],
        name=name,
        key_prefix=_key_display_prefix(raw_key),
        key_hash=_hash_key(raw_key),
        allowed_domains=_serialize_domains(domains),
        callback_url=callback or None,
        is_active=True,
    )
    db.add(key_obj)
    db.commit()
    db.refresh(key_obj)

    result = _key_to_dict(key_obj)
    result["key"] = raw_key  # ONLY returned on creation
    result["warning"] = "Lưu lại key này ngay! Bạn sẽ không thể xem lại sau."
    return result


@router.put("/{key_id}")
def update_key(
    key_id: int,
    body: UpdateKeyRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key_obj = db.query(ApiKey).filter(
        ApiKey.id == key_id, ApiKey.user_id == user["user_id"]
    ).first()
    if not key_obj:
        raise HTTPException(404, "Key không tồn tại")

    if body.name is not None:
        key_obj.name = body.name.strip() or key_obj.name

    if body.allowed_domains is not None:
        domains = _parse_domains(body.allowed_domains)
        if not domains:
            raise HTTPException(400, "Phải có ít nhất 1 domain")
        key_obj.allowed_domains = _serialize_domains(domains)

    if body.callback_url is not None:
        callback = body.callback_url.strip()
        if callback:
            parsed = urlparse(callback)
            if not parsed.scheme or not parsed.hostname:
                raise HTTPException(400, "Callback URL không hợp lệ")
        key_obj.callback_url = callback or None

    db.commit()
    return _key_to_dict(key_obj)


@router.delete("/{key_id}")
def revoke_key(
    key_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    key_obj = db.query(ApiKey).filter(
        ApiKey.id == key_id, ApiKey.user_id == user["user_id"]
    ).first()
    if not key_obj:
        raise HTTPException(404, "Key không tồn tại")
    key_obj.is_active = False
    db.commit()
    return {"ok": True}


# ── Admin Routes ───────────────────────────────────────

@router.get("/admin/all", dependencies=[Depends(get_current_admin)])
def admin_list_all_keys(db: Session = Depends(get_db)):
    """Admin: list all API keys across all users."""
    keys = db.query(ApiKey).order_by(ApiKey.created_at.desc()).limit(200).all()
    # Enrich with user email
    user_ids = list({k.user_id for k in keys})
    users = {str(u.id): u.email for u in db.query(User).filter(User.id.in_([int(uid) for uid in user_ids if uid.isdigit()])).all()} if user_ids else {}
    result = []
    for k in keys:
        d = _key_to_dict(k, show_user=True)
        d["user_email"] = users.get(k.user_id, "—")
        result.append(d)
    return result


@router.put("/admin/{key_id}/toggle", dependencies=[Depends(get_current_admin)])
def admin_toggle_key(key_id: int, db: Session = Depends(get_db)):
    """Admin: activate/deactivate any key."""
    key_obj = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not key_obj:
        raise HTTPException(404, "Key không tồn tại")
    key_obj.is_active = not key_obj.is_active
    db.commit()
    return {"ok": True, "is_active": key_obj.is_active}


@router.delete("/admin/{key_id}", dependencies=[Depends(get_current_admin)])
def admin_delete_key(key_id: int, db: Session = Depends(get_db)):
    """Admin: permanently delete a key."""
    key_obj = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not key_obj:
        raise HTTPException(404, "Key không tồn tại")
    db.delete(key_obj)
    db.commit()
    return {"ok": True}
