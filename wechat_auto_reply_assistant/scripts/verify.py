from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
PORT = 8091
TOKEN = "verify-token"


def request_json(method: str, path: str, payload: dict | None = None, auth: bool = True) -> tuple[int, dict]:
    url = f"http://{HOST}:{PORT}{path}"
    body = None
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {TOKEN}"
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(url=url, method=method, headers=headers, data=body)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return int(resp.status), json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return int(exc.code), json.loads(exc.read().decode("utf-8"))


def wait_for_server() -> None:
    for _ in range(40):
        try:
            code, payload = request_json("GET", "/health", auth=False)
            if code == 200 and payload.get("status") == "ok":
                return
        except Exception:
            pass
        time.sleep(0.25)
    raise RuntimeError("server not ready")


def main() -> int:
    db_path = ROOT / "verify.db"
    if db_path.exists():
        db_path.unlink()

    env = os.environ.copy()
    env["WXA_API_TOKEN"] = TOKEN
    env["WXA_HOST"] = HOST
    env["WXA_PORT"] = str(PORT)
    env["WXA_DB_PATH"] = str(db_path)

    proc = subprocess.Popen(
        [sys.executable, "main.py"],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        wait_for_server()

        code, _ = request_json("GET", "/api/v1/metrics")
        if code != 200:
            raise RuntimeError("metrics endpoint failed")

        code, auto_reply = request_json(
            "POST",
            "/api/v1/messages/inbound",
            {
                "conversation_id": "c100",
                "user_id": "u100",
                "channel": "wechat_work",
                "message_text": "请问订单物流怎么查",
            },
        )
        if code != 200 or auto_reply.get("action") != "auto_reply":
            raise RuntimeError("auto reply flow failed")

        code, high_risk = request_json(
            "POST",
            "/api/v1/messages/inbound",
            {
                "conversation_id": "c200",
                "user_id": "u200",
                "channel": "wechat_work",
                "message_text": "我要退款并投诉你们",
            },
        )
        if code != 200 or high_risk.get("action") != "handoff":
            raise RuntimeError("handoff flow failed")

        code, takeover = request_json("POST", "/api/v1/conversations/c300/takeover", {})
        if code != 200 or takeover.get("status") != "manual":
            raise RuntimeError("takeover failed")

        code, manual_notice = request_json(
            "POST",
            "/api/v1/messages/inbound",
            {
                "conversation_id": "c300",
                "user_id": "u300",
                "channel": "wechat_work",
                "message_text": "你好，你们在吗",
            },
        )
        if code != 200 or manual_notice.get("action") != "manual_only":
            raise RuntimeError("manual mode flow failed")

        code, logs = request_json("GET", "/api/v1/audit?limit=20")
        if code != 200 or len(logs.get("items", [])) == 0:
            raise RuntimeError("audit query failed")

        print("verify ok")
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
