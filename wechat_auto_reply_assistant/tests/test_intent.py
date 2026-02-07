from __future__ import annotations

import unittest

from app.intent import classify_intent


class IntentTests(unittest.TestCase):
    def test_high_risk_refund(self) -> None:
        result = classify_intent("我要申请退款")
        self.assertEqual(result.risk_level, "high")
        self.assertEqual(result.intent, "refund")

    def test_high_risk_complaint(self) -> None:
        result = classify_intent("我要投诉你们")
        self.assertEqual(result.risk_level, "high")
        self.assertEqual(result.intent, "complaint")

    def test_order_status_intent(self) -> None:
        result = classify_intent("请问订单物流到哪了")
        self.assertEqual(result.intent, "order_status")
        self.assertGreater(result.confidence, 0.6)

    def test_unknown_intent_low_confidence(self) -> None:
        result = classify_intent("随便聊聊")
        self.assertEqual(result.intent, "general_inquiry")
        self.assertLess(result.confidence, 0.5)


if __name__ == "__main__":
    unittest.main()
