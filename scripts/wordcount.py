#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MANUSCRIPT_DIR = ROOT / "manuscript"


def count_cn_chars(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", text))


def count_non_space_tokens(text: str) -> int:
    # Lightweight proxy for mixed-language token count.
    return len(re.findall(r"\S+", text))


def main() -> int:
    if not MANUSCRIPT_DIR.exists():
        print("manuscript/ not found")
        return 1

    files = sorted(MANUSCRIPT_DIR.glob("*.md"))
    total_cn = 0
    total_tokens = 0

    print("file,cn_chars,non_space_tokens")
    for path in files:
        text = path.read_text(encoding="utf-8")
        cn = count_cn_chars(text)
        tk = count_non_space_tokens(text)
        total_cn += cn
        total_tokens += tk
        print(f"{path.name},{cn},{tk}")

    print(f"TOTAL,{total_cn},{total_tokens}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
