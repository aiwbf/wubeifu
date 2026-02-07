from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    api_token: str
    host: str
    port: int
    db_path: str
    rate_limit_per_minute: int
    low_confidence_threshold: float


def _require_env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None or value.strip() == "":
        raise ValueError(f"missing required environment variable: {name}")
    return value


def load_settings() -> Settings:
    return Settings(
        api_token=_require_env("WXA_API_TOKEN", "dev-token"),
        host=_require_env("WXA_HOST", "127.0.0.1"),
        port=int(_require_env("WXA_PORT", "8080")),
        db_path=_require_env("WXA_DB_PATH", "./data.db"),
        rate_limit_per_minute=int(_require_env("WXA_RATE_LIMIT", "120")),
        low_confidence_threshold=float(_require_env("WXA_LOW_CONFIDENCE", "0.45")),
    )
