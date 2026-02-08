#!/usr/bin/env python3
from __future__ import annotations

import argparse
import itertools
import re
from hashlib import sha1
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MANUSCRIPT_DIR = ROOT / "manuscript"


def normalize(text: str) -> str:
    text = re.sub(r"\s+", " ", text.strip())
    return text


def split_paragraphs(text: str) -> list[str]:
    parts = re.split(r"\n\s*\n", text)
    out: list[str] = []
    for p in parts:
        n = normalize(p)
        if len(n) < 40:
            continue
        # Skip scaffold placeholders during Step 1 baseline checks.
        if "占位" in n or "待 Step" in n:
            continue
        out.append(p.strip())
    return out


def shingles(text: str, k: int = 8) -> set[str]:
    t = normalize(text)
    if len(t) < k:
        return {t}
    return {t[i : i + k] for i in range(len(t) - k + 1)}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    if union == 0:
        return 0.0
    return inter / union


def main() -> int:
    parser = argparse.ArgumentParser(description="Find duplicate/high-similarity paragraphs.")
    parser.add_argument("--threshold", type=float, default=0.78, help="Similarity threshold.")
    args = parser.parse_args()

    files = sorted(MANUSCRIPT_DIR.glob("*.md"))
    paragraphs: list[tuple[str, int, str]] = []

    for path in files:
        text = path.read_text(encoding="utf-8")
        paras = split_paragraphs(text)
        for idx, p in enumerate(paras, start=1):
            paragraphs.append((path.name, idx, p))

    exact_map: dict[str, list[tuple[str, int]]] = {}
    for fn, idx, p in paragraphs:
        h = sha1(normalize(p).encode("utf-8")).hexdigest()
        exact_map.setdefault(h, []).append((fn, idx))

    exact_hits = [v for v in exact_map.values() if len(v) > 1]
    fuzzy_hits: list[tuple[tuple[str, int], tuple[str, int], float]] = []

    sig_cache = [shingles(p) for _, _, p in paragraphs]
    for i, j in itertools.combinations(range(len(paragraphs)), 2):
        sim = jaccard(sig_cache[i], sig_cache[j])
        if sim >= args.threshold:
            a = (paragraphs[i][0], paragraphs[i][1])
            b = (paragraphs[j][0], paragraphs[j][1])
            fuzzy_hits.append((a, b, sim))

    print(f"TOTAL_PARAGRAPHS={len(paragraphs)}")
    print(f"EXACT_DUP_GROUPS={len(exact_hits)}")
    for group in exact_hits:
        group_str = "; ".join([f"{fn}#P{pi}" for fn, pi in group])
        print(f"EXACT: {group_str}")

    print(f"FUZZY_HITS(threshold={args.threshold})={len(fuzzy_hits)}")
    for (fa, pa), (fb, pb), sim in fuzzy_hits:
        print(f"FUZZY: {fa}#P{pa} <-> {fb}#P{pb} :: {sim:.3f}")

    return 0 if not exact_hits and not fuzzy_hits else 2


if __name__ == "__main__":
    raise SystemExit(main())
