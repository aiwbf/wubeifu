from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inbound_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    message_text TEXT NOT NULL,
    intent TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    confidence REAL NOT NULL,
    action TEXT NOT NULL,
    suggested_reply TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbound_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    reply_text TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: str) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def migrate(self) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA)

    def ensure_conversation(self, conversation_id: str) -> str:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT status FROM conversations WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()
            if row:
                return str(row["status"])
            conn.execute(
                "INSERT INTO conversations(conversation_id, status, updated_at) VALUES(?, ?, ?)",
                (conversation_id, "auto", _utcnow_iso()),
            )
            return "auto"

    def set_conversation_status(self, conversation_id: str, status: str, actor: str) -> None:
        now = _utcnow_iso()
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO conversations(conversation_id, status, updated_at) VALUES(?, ?, ?) "
                "ON CONFLICT(conversation_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at",
                (conversation_id, status, now),
            )
            self._insert_audit(
                conn,
                event_type="conversation.status_changed",
                actor=actor,
                payload={"conversation_id": conversation_id, "status": status},
            )

    def insert_inbound(
        self,
        conversation_id: str,
        user_id: str,
        channel: str,
        message_text: str,
        intent: str,
        risk_level: str,
        confidence: float,
        action: str,
        suggested_reply: str,
    ) -> int:
        now = _utcnow_iso()
        with self.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO inbound_messages(
                    conversation_id, user_id, channel, message_text, intent, risk_level,
                    confidence, action, suggested_reply, created_at
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    conversation_id,
                    user_id,
                    channel,
                    message_text,
                    intent,
                    risk_level,
                    confidence,
                    action,
                    suggested_reply,
                    now,
                ),
            )
            self._insert_audit(
                conn,
                event_type="message.inbound",
                actor="system",
                payload={
                    "conversation_id": conversation_id,
                    "intent": intent,
                    "risk_level": risk_level,
                    "action": action,
                },
            )
            return int(cur.lastrowid)

    def insert_outbound(self, conversation_id: str, mode: str, reply_text: str) -> int:
        now = _utcnow_iso()
        with self.connect() as conn:
            cur = conn.execute(
                "INSERT INTO outbound_messages(conversation_id, mode, reply_text, created_at) VALUES(?, ?, ?, ?)",
                (conversation_id, mode, reply_text, now),
            )
            self._insert_audit(
                conn,
                event_type="message.outbound",
                actor="system",
                payload={"conversation_id": conversation_id, "mode": mode},
            )
            return int(cur.lastrowid)

    def list_audit_logs(self, limit: int = 100) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT id, event_type, actor, payload_json, created_at FROM audit_logs ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            data: list[dict[str, Any]] = []
            for row in rows:
                data.append(
                    {
                        "id": int(row["id"]),
                        "event_type": str(row["event_type"]),
                        "actor": str(row["actor"]),
                        "payload": json.loads(str(row["payload_json"])),
                        "created_at": str(row["created_at"]),
                    }
                )
            return data

    def metrics(self) -> dict[str, Any]:
        with self.connect() as conn:
            total_inbound = conn.execute("SELECT COUNT(*) AS c FROM inbound_messages").fetchone()["c"]
            total_outbound = conn.execute("SELECT COUNT(*) AS c FROM outbound_messages").fetchone()["c"]
            manual_queue = conn.execute(
                "SELECT COUNT(*) AS c FROM inbound_messages WHERE action = 'handoff'"
            ).fetchone()["c"]
            return {
                "total_inbound": int(total_inbound),
                "total_outbound": int(total_outbound),
                "manual_handoff": int(manual_queue),
            }

    def _insert_audit(
        self,
        conn: sqlite3.Connection,
        event_type: str,
        actor: str,
        payload: dict[str, Any],
    ) -> None:
        conn.execute(
            "INSERT INTO audit_logs(event_type, actor, payload_json, created_at) VALUES(?, ?, ?, ?)",
            (event_type, actor, json.dumps(payload, ensure_ascii=False), _utcnow_iso()),
        )
