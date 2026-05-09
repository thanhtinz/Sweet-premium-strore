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


def require_feature(feature_name: str):
    """Returns a FastAPI dependency that raises 403 if feature is disabled."""
    def _guard(db: Session = Depends(get_db)):
        features = _load_features(db)
        if features.get(feature_name) is False:
            raise HTTPException(
                status_code=403,
                detail=f"Chức năng '{feature_name}' đang tắt"
            )
    return _guard
