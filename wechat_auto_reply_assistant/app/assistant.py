from __future__ import annotations

from dataclasses import dataclass

from .config import Settings
from .db import Database
from .intent import IntentResult, classify_intent
from .knowledge import KnowledgeBase


@dataclass(frozen=True)
class ReplyResult:
    action: str
    response_text: str
    intent: str
    confidence: float
    risk_level: str
    conversation_status: str


class AssistantService:
    def __init__(self, db: Database, kb: KnowledgeBase, settings: Settings) -> None:
        self.db = db
        self.kb = kb
        self.settings = settings

    def handle_inbound(
        self,
        conversation_id: str,
        user_id: str,
        channel: str,
        message_text: str,
    ) -> ReplyResult:
        status = self.db.ensure_conversation(conversation_id)
        intent = classify_intent(message_text)

        if status == "manual":
            result = ReplyResult(
                action="manual_only",
                response_text="当前会话已转人工，我们会尽快回复。",
                intent=intent.intent,
                confidence=intent.confidence,
                risk_level=intent.risk_level,
                conversation_status=status,
            )
            self._persist(conversation_id, user_id, channel, message_text, result)
            return result

        if _must_handoff(intent, self.settings.low_confidence_threshold):
            self.db.set_conversation_status(conversation_id, "manual", actor="system")
            result = ReplyResult(
                action="handoff",
                response_text="该问题已自动转交人工专员处理，请稍候。",
                intent=intent.intent,
                confidence=intent.confidence,
                risk_level=intent.risk_level,
                conversation_status="manual",
            )
            self._persist(conversation_id, user_id, channel, message_text, result)
            return result

        kb_hit = self.kb.retrieve(message_text)
        if kb_hit:
            reply = f"{kb_hit.answer}\n\n（参考问题：{kb_hit.question}）"
            confidence = max(intent.confidence, min(0.92, kb_hit.score + 0.4))
        else:
            reply = "已收到你的问题，我已记录并将尽快安排专员回复。"
            confidence = intent.confidence

        result = ReplyResult(
            action="auto_reply",
            response_text=reply,
            intent=intent.intent,
            confidence=confidence,
            risk_level=intent.risk_level,
            conversation_status=status,
        )
        self._persist(conversation_id, user_id, channel, message_text, result)
        return result

    def takeover(self, conversation_id: str, actor: str) -> None:
        self.db.set_conversation_status(conversation_id, "manual", actor=actor)

    def release(self, conversation_id: str, actor: str) -> None:
        self.db.set_conversation_status(conversation_id, "auto", actor=actor)

    def _persist(
        self,
        conversation_id: str,
        user_id: str,
        channel: str,
        message_text: str,
        result: ReplyResult,
    ) -> None:
        self.db.insert_inbound(
            conversation_id=conversation_id,
            user_id=user_id,
            channel=channel,
            message_text=message_text,
            intent=result.intent,
            risk_level=result.risk_level,
            confidence=result.confidence,
            action=result.action,
            suggested_reply=result.response_text,
        )
        if result.action in {"auto_reply", "manual_only"}:
            mode = "auto" if result.action == "auto_reply" else "manual_notice"
            self.db.insert_outbound(conversation_id=conversation_id, mode=mode, reply_text=result.response_text)


def _must_handoff(intent: IntentResult, threshold: float) -> bool:
    if intent.risk_level == "high":
        return True
    return intent.confidence < threshold
