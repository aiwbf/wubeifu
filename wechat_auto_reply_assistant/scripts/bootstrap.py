from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import load_settings
from app.db import Database


def main() -> int:
    settings = load_settings()
    db = Database(settings.db_path)
    db.migrate()
    print(f"bootstrap ok: db ready at {Path(settings.db_path).resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
