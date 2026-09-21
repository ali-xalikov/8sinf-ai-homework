"""Oddiy sliding-window rate limiter (in-memory, qator bo'yicha)."""
from __future__ import annotations

import threading
import time
from typing import Dict, Tuple

_lock = threading.Lock()
_hits: Dict[str, list] = {}


def check(key: str, limit: int, window_seconds: float = 60.0) -> Tuple[bool, int]:
    """(ruxsat, qolgan son) qaytaradi. limit<=0 -> cheklov yo'q."""
    if limit <= 0:
        return True, -1
    now = time.monotonic()
    with _lock:
        bucket = _hits.setdefault(key, [])
        bucket[:] = [t for t in bucket if now - t < window_seconds]
        if len(bucket) >= limit:
            return False, max(0, limit - len(bucket))
        bucket.append(now)
        return True, max(0, limit - len(bucket))