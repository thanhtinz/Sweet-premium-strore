"""Feature guard dependency for FastAPI routes.

Usage:
    from api.feature_guard import require_feature
    
    @router.get("/", dependencies=[Depends(require_feature("blog"))])
    def list_posts(...):
"""
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from db import get_db
from db.repositories import SiteConfigRepository
import json

_cache = {"data": {}, "ts": 0}


def _load_features(db: Session) -> dict:
    """Load features config with simple time-based cache (10s)."""
    import time
    now = time.time()
    if now - _cache["ts"] < 10 and _cache["data"]:
        return _cache["data"]
    row = SiteConfigRepository(db).get_value("settings_features")
    if row:
        try:
            _cache["data"] = json.loads(row)
        except (json.JSONDecodeError, TypeError):
            _cache["data"] = {}
    else:
        _cache["data"] = {}
    _cache["ts"] = now
    return _cache["data"]


_FEATURE_LABELS = {
    "blog": "Blog",
    "offers": "Ưu đãi / Gift Code",
    "affiliate": "Affiliate / Giới thiệu",
    "support": "Hỗ trợ",
    "flash_sales": "Flash Sale",
    "reviews": "Đánh giá sản phẩm",
    "announcements": "Thông báo",
    "balance": "Số dư / Nạp tiền",
    "wishlist": "Yêu thích",
    "api_docs": "Tài liệu API / API Keys",
}

# Features that default to OFF (must be explicitly enabled)
_OPT_IN_FEATURES = {"api_docs"}


def require_feature(feature_name: str):
    """Returns a FastAPI dependency that raises 403 if feature is disabled."""
    def _guard(db: Session = Depends(get_db)):
        features = _load_features(db)
        if feature_name in _OPT_IN_FEATURES:
            disabled = features.get(feature_name) is not True
        else:
            disabled = features.get(feature_name) is False
        if disabled:
            label = _FEATURE_LABELS.get(feature_name, feature_name)
            raise HTTPException(
                status_code=403,
                detail=f"Tính năng \"{label}\" hiện đang tắt. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ."
            )
    return _guard
