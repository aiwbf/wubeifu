from __future__ import annotations

import unittest
from pathlib import Path

from app.knowledge import KnowledgeBase


ROOT = Path(__file__).resolve().parents[1]


class KnowledgeTests(unittest.TestCase):
    def test_retrieve_hit(self) -> None:
        kb = KnowledgeBase(str(ROOT / "knowledge" / "faq.json"))
        hit = kb.retrieve("怎么查看物流")
        self.assertIsNotNone(hit)
        assert hit is not None
        self.assertIn("物流", hit.answer)

    def test_retrieve_no_hit(self) -> None:
        kb = KnowledgeBase(str(ROOT / "knowledge" / "faq.json"))
        hit = kb.retrieve("@@@@@@@@")
        self.assertIsNone(hit)


if __name__ == "__main__":
    unittest.main()
