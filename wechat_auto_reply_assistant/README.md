# WeChat Auto Reply Assistant (Compliant)

## Overview
A compliant auto-reply assistant for Enterprise WeChat / Official Account service workflows.
It supports: inbound message handling, risk-based handoff, manual takeover/release, audit logs, and metrics.

## Compliance Scope
- Uses only official-channel style integration boundaries.
- Does **not** implement personal WeChat login automation, protocol reverse engineering, or message content scraping outside inbound payload.
- High-risk intents (refund/legal/medical/complaint) are auto-routed to manual handling.

## Project Structure
- `main.py`: application entrypoint.
- `app/config.py`: centralized env parsing.
- `app/server.py`: HTTP API layer.
- `app/assistant.py`: orchestration (intent + knowledge + routing).
- `app/db.py`: sqlite storage and audit persistence.
- `app/intent.py`: intent and risk classifier.
- `app/knowledge.py`: FAQ retrieval.
- `tests/`: unit + integration + e2e tests.
- `scripts/`: bootstrap/lint/test/build/verify tooling.

## Quick Start
```powershell
cd wechat_auto_reply_assistant
$env:WXA_API_TOKEN="dev-token"
python scripts/bootstrap.py
python main.py
```

## Commands
- Lint: `python scripts/lint.py`
- Test: `python scripts/test.py`
- Build: `python scripts/build.py`
- Verify (e2e): `python scripts/verify.py`
- Run: `python main.py`

## Environment Variables
- `WXA_API_TOKEN` (default: `dev-token`)
- `WXA_HOST` (default: `127.0.0.1`)
- `WXA_PORT` (default: `8080`)
- `WXA_DB_PATH` (default: `./data.db`)
- `WXA_RATE_LIMIT` (default: `120`)
- `WXA_LOW_CONFIDENCE` (default: `0.45`)

## Core API Examples
```powershell
# Health
curl http://127.0.0.1:8080/health

# Inbound message
curl -X POST http://127.0.0.1:8080/api/v1/messages/inbound `
  -H "Authorization: Bearer dev-token" `
  -H "Content-Type: application/json" `
  -d '{"conversation_id":"c1","user_id":"u1","channel":"wechat_work","message_text":"订单怎么查物流"}'
```

## Rollback
- Service rollback: stop process and restart previous commit.
- Data rollback: restore prior sqlite snapshot of `WXA_DB_PATH`.
- Feature rollback: switch conversation to manual mode (`/takeover`) to bypass auto-reply immediately.
