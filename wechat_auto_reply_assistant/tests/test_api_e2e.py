from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
TOKEN = "test-token"
PORT = 18123


def _free_port() -> int:
    with socket.socket() as s:
        s.bind((HOST, 0))
        return int(s.getsockname()[1])


def request_json(method: str, path: str, payload: dict | None = None, auth: bool = True) -> tuple[int, dict]:
    url = f"http://{HOST}:{PORT}{path}"
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {TOKEN}"
    body = None
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, method=method, headers=headers, data=body)
    try:
        with urllib.request.urlopen(req, timeout=2) as resp:
            return int(resp.status), json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return int(exc.code), json.loads(exc.read().decode("utf-8"))


class ApiE2ETests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        global PORT
        PORT = _free_port()
        cls.db_file = ROOT / ".api_e2e_test.db"
        if cls.db_file.exists():
            cls.db_file.unlink()
        env = os.environ.copy()
        env["WXA_API_TOKEN"] = TOKEN
        env["WXA_HOST"] = HOST
        env["WXA_PORT"] = str(PORT)
        env["WXA_DB_PATH"] = str(cls.db_file)
        env["WXA_RATE_LIMIT"] = "100"
        cls.proc = subprocess.Popen(
            [sys.executable, "main.py"],
            cwd=str(ROOT),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        for _ in range(40):
            try:
                code, _ = request_json("GET", "/health", auth=False)
                if code == 200:
                    return
            except Exception:
                pass
            time.sleep(0.2)
        raise RuntimeError("server did not start")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.proc.terminate()
        try:
            cls.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.proc.kill()
        if cls.db_file.exists():
            cls.db_file.unlink()

    def test_health(self) -> None:
        code, payload = request_json("GET", "/health", auth=False)
        self.assertEqual(code, 200)
        self.assertEqual(payload.get("status"), "ok")

    def test_auth_required(self) -> None:
        code, payload = request_json("GET", "/api/v1/metrics", auth=False)
        self.assertEqual(code, 401)
        self.assertEqual(payload["error"]["code"], "UNAUTHORIZED")

    def test_inbound_auto_reply(self) -> None:
        code, payload = request_json(
            "POST",
            "/api/v1/messages/inbound",
            {
                "conversation_id": "c900",
                "user_id": "u900",
                "channel": "wechat_work",
                "message_text": "如何查询物流",
            },
        )
        self.assertEqual(code, 200)
        self.assertEqual(payload.get("action"), "auto_reply")

    def test_takeover_and_manual_only(self) -> None:
        code, payload = request_json("POST", "/api/v1/conversations/c901/takeover", {})
        self.assertEqual(code, 200)
        self.assertEqual(payload.get("status"), "manual")

        code, payload = request_json(
            "POST",
            "/api/v1/messages/inbound",
            {
                "conversation_id": "c901",
                "user_id": "u901",
                "channel": "wechat_work",
                "message_text": "您好",
            },
        )
        self.assertEqual(code, 200)
        self.assertEqual(payload.get("action"), "manual_only")


if __name__ == "__main__":
    unittest.main()
