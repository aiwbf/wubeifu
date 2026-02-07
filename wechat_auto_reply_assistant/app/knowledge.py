from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class KnowledgeHit:
    question: str
    answer: str
    score: float


class KnowledgeBase:
    def __init__(self, path: str) -> None:
        self.path = Path(path)
        self.entries = self._load()

    def _load(self) -> list[dict[str, str]]:
        if not self.path.exists():
            return []
        data = json.loads(self.path.read_text(encoding="utf-8-sig"))
        out: list[dict[str, str]] = []
        for row in data:
            q = str(row.get("question", "")).strip()
            a = str(row.get("answer", "")).strip()
            if q and a:
                out.append({"question": q, "answer": a})
        return out

    def retrieve(self, query: str) -> KnowledgeHit | None:
        if not self.entries:
            return None
        q_tokens = _tokenize(query)
        if not q_tokens:
            return None

        best: KnowledgeHit | None = None
        for row in self.entries:
            score = _similarity(q_tokens, _tokenize(row["question"]))
            if best is None or score > best.score:
                best = KnowledgeHit(question=row["question"], answer=row["answer"], score=score)

        if best is None or best.score < 0.1:
            return None
        return best


def _tokenize(text: str) -> set[str]:
    lowered = text.lower()
    tokens = set(t for t in re.split(r"[^a-zA-Z0-9\u4e00-\u9fff]+", lowered) if t)
    # Add single CJK characters to improve recall without external NLP dependency.
    tokens.update(ch for ch in lowered if "\u4e00" <= ch <= "\u9fff")
    return tokens


def _similarity(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    common = len(a & b)
    return common / max(len(a), len(b))
