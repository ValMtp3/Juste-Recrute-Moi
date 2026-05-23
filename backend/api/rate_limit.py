from __future__ import annotations

import math
import time
import threading
from collections import defaultdict

from fastapi import HTTPException


class RateLimiter:
    def __init__(self, max_calls: int, window_seconds: int):
        self.max_calls = max_calls
        self.window = window_seconds
        self._calls: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def allow(self, key: str = "global") -> bool:
        with self._lock:
            now = time.monotonic()
            self._calls[key] = [t for t in self._calls[key] if now - t < self.window]
            if len(self._calls[key]) >= self.max_calls:
                return False
            self._calls[key].append(now)
            return True

    def retry_after(self, key: str = "global") -> int:
        """Seconds until the next call would be allowed (M3).

        Zero when a slot is currently free. Otherwise the time until the oldest
        in-window call expires, rounded up and clamped to at least 1 second.
        """
        with self._lock:
            now = time.monotonic()
            calls = [t for t in self._calls[key] if now - t < self.window]
            if len(calls) < self.max_calls or not calls:
                return 0
            oldest = min(calls)
            return max(1, math.ceil(self.window - (now - oldest)))


def require_rate_limit(limiter: RateLimiter, key: str = "global") -> None:
    if not limiter.allow(key):
        # M3: tell the client exactly how long to wait, both via the standard
        # Retry-After header and a human-readable message.
        wait = limiter.retry_after(key)
        plural = "" if wait == 1 else "s"
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Please wait {wait} second{plural}.",
            headers={"Retry-After": str(wait)},
        )
