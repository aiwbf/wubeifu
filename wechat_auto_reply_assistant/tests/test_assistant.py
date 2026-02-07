from __future__ import annotations

import unittest
from pathlib import Path

from app.assistant import AssistantService
from app.config import Settings
from app.db import Database
from app.knowledge import KnowledgeBase


ROOT = Path(__file__).resolve().parents[1]


class AssistantTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db_file = ROOT / ".assistant_test.db"
        if self.db_file.exists():
            self.db_file.unlink()
        self.settings = Settings(
            api_token="token",
            host="127.0.0.1",
            port=18080,
            db_path=str(self.db_file),
            rate_limit_per_minute=100,
            low_confidence_threshold=0.45,
        )
        self.db = Database(str(self.db_file))
        self.db.migrate()
        self.kb = KnowledgeBase(str(ROOT / "knowledge" / "faq.json"))
        self.service = AssistantService(self.db, self.kb, self.settings)

    def tearDown(self) -> None:
        if self.db_file.exists():
            self.db_file.unlink()

    def test_auto_reply_flow(self) -> None:
        out = self.service.handle_inbound("c1", "u1", "wechat_work", "订单物流怎么查")
        self.assertEqual(out.action, "auto_reply")
        self.assertEqual(out.conversation_status, "auto")

    def test_handoff_on_high_risk(self) -> None:
        out = self.service.handle_inbound("c2", "u2", "wechat_work", "我要退款")
        self.assertEqual(out.action, "handoff")
        self.assertEqual(out.conversation_status, "manual")

    def test_manual_mode_blocks_auto(self) -> None:
        self.service.takeover("c3", actor="tester")
        out = self.service.handle_inbound("c3", "u3", "wechat_work", "你好")
        self.assertEqual(out.action, "manual_only")


if __name__ == "__main__":
    unittest.main()
