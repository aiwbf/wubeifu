#!/usr/bin/env python3
from __future__ import annotations

import csv
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "research"
MANUSCRIPT = ROOT / "manuscript"


def load_timeline_ids() -> set[str]:
    path = RESEARCH / "timeline.csv"
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    return {r["event_id"].strip() for r in rows if r.get("event_id")}


def load_claim_ids() -> set[str]:
    text = (RESEARCH / "claim_ledger.md").read_text(encoding="utf-8")
    return set(re.findall(r"\bC-\d{3}\b", text))


def load_source_ids() -> set[str]:
    text = (RESEARCH / "source_catalog.md").read_text(encoding="utf-8")
    return set(re.findall(r"\bS\d{2}\b", text))


def scan_manuscript_ids() -> tuple[set[str], set[str], set[str]]:
    eids: set[str] = set()
    cids: set[str] = set()
    sids: set[str] = set()
    for p in sorted(MANUSCRIPT.glob("*.md")):
        t = p.read_text(encoding="utf-8")
        eids |= set(re.findall(r"\bE-\d{4}-\d{3}\b", t))
        cids |= set(re.findall(r"\bC-\d{3}\b", t))
        sids |= set(re.findall(r"\bS\d{2}\b", t))
    return eids, cids, sids


def main() -> int:
    timeline_ids = load_timeline_ids()
    claim_ids = load_claim_ids()
    source_ids = load_source_ids()
    used_eids, used_cids, used_sids = scan_manuscript_ids()

    missing_eids = sorted(used_eids - timeline_ids)
    missing_cids = sorted(used_cids - claim_ids)
    missing_sids = sorted(used_sids - source_ids)

    print(f"TIMELINE_IDS={len(timeline_ids)} USED_EIDS={len(used_eids)}")
    print(f"CLAIM_IDS={len(claim_ids)} USED_CIDS={len(used_cids)}")
    print(f"SOURCE_IDS={len(source_ids)} USED_SIDS={len(used_sids)}")

    if missing_eids:
        print("MISSING_EIDS:", ",".join(missing_eids))
    if missing_cids:
        print("MISSING_CIDS:", ",".join(missing_cids))
    if missing_sids:
        print("MISSING_SIDS:", ",".join(missing_sids))

    ok = not missing_eids and not missing_cids and not missing_sids
    print("CONSISTENCY_OK=" + ("1" if ok else "0"))
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())

