from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class IntentResult:
    intent: str
    confidence: float
    risk_level: str


HIGH_RISK_KEYWORDS = {
    "refund": ["退款", "退钱", "退费", "chargeback"],
    "legal": ["律师", "起诉", "法律", "仲裁", "举报"],
    "medical": ["医疗", "处方", "诊断", "药物"],
    "complaint": ["投诉", "曝光", "维权", "差评"],
}

INTENT_PATTERNS = {
    "order_status": ["订单", "发货", "物流", "到货"],
    "pricing": ["价格", "费用", "多少钱", "优惠"],
    "technical_support": ["故障", "无法", "打不开", "报错"],
    "greeting": ["你好", "您好", "在吗", "hello"],
}


def classify_intent(text: str) -> IntentResult:
    lowered = text.lower()

    for risk_intent, keywords in HIGH_RISK_KEYWORDS.items():
        if any(k in lowered for k in keywords):
            return IntentResult(intent=risk_intent, confidence=0.95, risk_level="high")

    best_intent = "general_inquiry"
    best_score = 0
    for intent, keywords in INTENT_PATTERNS.items():
        score = sum(1 for k in keywords if k in lowered)
        if score > best_score:
            best_intent = intent
            best_score = score

    if best_score == 0:
        return IntentResult(intent="general_inquiry", confidence=0.35, risk_level="low")
    if best_score == 1:
        return IntentResult(intent=best_intent, confidence=0.62, risk_level="low")
    return IntentResult(intent=best_intent, confidence=0.78, risk_level="low")
