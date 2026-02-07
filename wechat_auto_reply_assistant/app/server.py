from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from .assistant import AssistantService
from .config import Settings
from .db import Database
from .knowledge import KnowledgeBase
from .security import RateLimiter, TokenAuth


@dataclass(frozen=True)
class ApiError:
    code: str
    message: str


class AppContext:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.db = Database(settings.db_path)
        self.db.migrate()
        self.kb = KnowledgeBase("./wechat_auto_reply_assistant/knowledge/faq.json")
        self.service = AssistantService(self.db, self.kb, settings)
        self.auth = TokenAuth(settings.api_token)
        self.rate_limiter = RateLimiter(settings.rate_limit_per_minute)


class WeChatHandler(BaseHTTPRequestHandler):
    context: AppContext

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def do_GET(self) -> None:  # noqa: N802
        if not self._guard():
            return

        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._json(HTTPStatus.OK, {"status": "ok"})
            return

        if parsed.path == "/api/v1/audit":
            limit = int(parse_qs(parsed.query).get("limit", ["50"])[0])
            self._json(HTTPStatus.OK, {"items": self.context.db.list_audit_logs(limit=limit)})
            return

        if parsed.path == "/api/v1/metrics":
            self._json(HTTPStatus.OK, self.context.db.metrics())
            return

        self._error(HTTPStatus.NOT_FOUND, "NOT_FOUND", "resource not found")

    def do_POST(self) -> None:  # noqa: N802
        if not self._guard():
            return

        parsed = urlparse(self.path)
        if parsed.path == "/api/v1/messages/inbound":
            self._handle_inbound()
            return

        if parsed.path.startswith("/api/v1/conversations/") and parsed.path.endswith("/takeover"):
            conversation_id = parsed.path.split("/")[4]
            self.context.service.takeover(conversation_id, actor="api")
            self._json(HTTPStatus.OK, {"conversation_id": conversation_id, "status": "manual"})
            return

        if parsed.path.startswith("/api/v1/conversations/") and parsed.path.endswith("/release"):
            conversation_id = parsed.path.split("/")[4]
            self.context.service.release(conversation_id, actor="api")
            self._json(HTTPStatus.OK, {"conversation_id": conversation_id, "status": "auto"})
            return

        self._error(HTTPStatus.NOT_FOUND, "NOT_FOUND", "resource not found")

    def _handle_inbound(self) -> None:
        payload = self._read_json()
        if payload is None:
            return

        required = ["conversation_id", "user_id", "channel", "message_text"]
        missing = [k for k in required if not str(payload.get(k, "")).strip()]
        if missing:
            self._error(
                HTTPStatus.BAD_REQUEST,
                "VALIDATION_ERROR",
                f"missing required fields: {','.join(missing)}",
            )
            return

        result = self.context.service.handle_inbound(
            conversation_id=str(payload["conversation_id"]),
            user_id=str(payload["user_id"]),
            channel=str(payload["channel"]),
            message_text=str(payload["message_text"]),
        )
        self._json(HTTPStatus.OK, asdict(result))

    def _read_json(self) -> dict[str, Any] | None:
        content_len = int(self.headers.get("Content-Length", "0"))
        if content_len <= 0:
            self._error(HTTPStatus.BAD_REQUEST, "EMPTY_BODY", "request body is empty")
            return None

        raw = self.rfile.read(content_len)
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._error(HTTPStatus.BAD_REQUEST, "INVALID_JSON", "request body is not valid JSON")
            return None
        if not isinstance(data, dict):
            self._error(HTTPStatus.BAD_REQUEST, "INVALID_PAYLOAD", "JSON payload must be object")
            return None
        return data

    def _guard(self) -> bool:
        if self.path == "/health":
            return True

        key = self.headers.get("Authorization", "")
        auth = self.context.auth.verify(key)
        if not auth.ok:
            self._error(HTTPStatus.UNAUTHORIZED, "UNAUTHORIZED", auth.error or "unauthorized")
            return False

        client = self.client_address[0] if self.client_address else "unknown"
        if not self.context.rate_limiter.allow(client):
            self._error(HTTPStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "rate limit exceeded")
            return False
        return True

    def _error(self, status: HTTPStatus, code: str, message: str) -> None:
        self._json(status, {"error": asdict(ApiError(code=code, message=message))})

    def _json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run_server(settings: Settings) -> None:
    context = AppContext(settings)

    class _BoundHandler(WeChatHandler):
        pass

    _BoundHandler.context = context
    server = ThreadingHTTPServer((settings.host, settings.port), _BoundHandler)
    print(f"wechat-assistant running on http://{settings.host}:{settings.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
