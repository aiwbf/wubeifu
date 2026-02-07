# ARCHITECTURE

## System Flow
1. `POST /api/v1/messages/inbound` receives message payload.
2. API layer enforces auth + rate limit + schema validation.
3. `AssistantService` classifies intent and risk.
4. For low-risk/high-confidence requests, KB retrieval generates auto reply.
5. For high-risk or low-confidence requests, conversation is switched to manual.
6. All actions are persisted and audited in sqlite.

## Key Modules
- `config.py`: single source for env/config.
- `security.py`: bearer auth and in-memory rate limiter.
- `intent.py`: deterministic intent + high-risk detection.
- `knowledge.py`: lexical FAQ retrieval.
- `assistant.py`: routing decision engine.
- `db.py`: persistence + audit trail.
- `server.py`: HTTP transport and error model.

## Data Model
- `conversations`: auto/manual mode state.
- `inbound_messages`: inbound payload + decision fields.
- `outbound_messages`: generated notices/replies.
- `audit_logs`: structured event trace for compliance.

## Tradeoffs
- Chosen sqlite + stdlib HTTP to avoid external dependency lock and keep deploy-simple.
- Classifier is rule-based for explainability and deterministic behavior.
- In-memory rate limiter is process-local (acceptable for MVP, move to Redis for multi-instance).

## Security Model
- Bearer token authorization for all non-health endpoints.
- Input validation and consistent error codes.
- High-risk intents default to manual handoff to reduce automation risk.

## Rollback Strategy
- Immediate safety rollback: force conversation to manual via `/takeover`.
- Code rollback: revert deployment artifact and restart service.
- Data rollback: restore sqlite snapshot.
