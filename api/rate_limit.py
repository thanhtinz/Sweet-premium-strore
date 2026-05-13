"""Simple in-memory rate limiter.

Sliding window per (key, scope). Designed for single-process FastAPI; if you
deploy multiple workers, swap the backend for Redis later. The API exposes a
single dependency factory `rate_limit(scope, max_calls, window_seconds)` that
keys by client IP + optional caller identifier.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request

# (scope, key) -> deque[timestamp]
_buckets: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def _client_key(request: Request) -> str:
    # Honor X-Forwarded-For (first IP) when present; otherwise use raw client host.
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host or "anon"
    return "anon"


def _check(scope: str, key: str, max_calls: int, window: float) -> bool:
    """Return True if the call is allowed, False otherwise. Records on allow."""
    now = time.monotonic()
    cutoff = now - window
    bucket_key = (scope, key)
    with _lock:
        bucket = _buckets[bucket_key]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= max_calls:
            return False
        bucket.append(now)
        return True


def rate_limit(scope: str, max_calls: int, window_seconds: float, key_extra: str | None = None):
    """FastAPI dependency factory that throttles by client IP.

    Usage:
        @router.post("/login", dependencies=[Depends(rate_limit("login", 5, 60))])
    """
    async def _dep(request: Request):
        key = _client_key(request)
        if key_extra:
            key = f"{key}:{key_extra}"
        if not _check(scope, key, max_calls, window_seconds):
            raise HTTPException(
                status_code=429,
                detail="Quá nhiều yêu cầu, vui lòng thử lại sau.",
            )
    return _dep


def rate_limit_by_value(scope: str, value: str, max_calls: int, window_seconds: float) -> None:
    """Imperative check (raise 429 inline). Useful when the key depends on body."""
    if not _check(scope, value or "anon", max_calls, window_seconds):
        raise HTTPException(
            status_code=429,
            detail="Quá nhiều yêu cầu, vui lòng thử lại sau.",
        )
