from __future__ import annotations

import compileall
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    ok = compileall.compile_dir(ROOT / "app", quiet=1)
    ok = compileall.compile_dir(ROOT / "tests", quiet=1) and ok
    ok = compileall.compile_file(str(ROOT / "main.py"), quiet=1) and ok
    if not (ROOT / "OPENAPI.yaml").exists():
        print("missing OPENAPI.yaml")
        return 1
    if ok:
        print("build ok")
        return 0
    print("build failed")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
