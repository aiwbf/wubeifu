from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass


@dataclass(frozen=True)
class AuthResult:
    ok: bool
    error: str | None = None


class TokenAuth:
    def __init__(self, token: str) -> None:
        self.token = token

    def verify(self, header_value: str | None) -> AuthResult:
        if not header_value:
            return AuthResult(ok=False, error="missing authorization header")
        if not header_value.startswith("Bearer "):
            return AuthResult(ok=False, error="invalid authorization scheme")
        if header_value.split(" ", 1)[1].strip() != self.token:
            return AuthResult(ok=False, error="invalid token")
        return AuthResult(ok=True)


class RateLimiter:
    def __init__(self, limit_per_minute: int) -> None:
        self.limit = limit_per_minute
        self._lock = threading.Lock()
        self._bucket: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.time()
        cutoff = now - 60.0
        with self._lock:
            dq = self._bucket[key]
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= self.limit:
                return False
            dq.append(now)
            return True
