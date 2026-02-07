from __future__ import annotations

import pathlib
import py_compile
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGETS = [ROOT / "app", ROOT / "tests", ROOT / "main.py", ROOT / "scripts"]


def iter_py_files() -> list[pathlib.Path]:
    files: list[pathlib.Path] = []
    for target in TARGETS:
        if target.is_file() and target.suffix == ".py":
            files.append(target)
            continue
        if target.is_dir():
            files.extend(sorted(target.rglob("*.py")))
    return files


def main() -> int:
    errors: list[str] = []
    for path in iter_py_files():
        text = path.read_text(encoding="utf-8")
        for idx, line in enumerate(text.splitlines(), start=1):
            if "\t" in line:
                errors.append(f"{path}:{idx}: tab character is not allowed")
            if line.rstrip(" ") != line:
                errors.append(f"{path}:{idx}: trailing whitespace")
            if len(line) > 120:
                errors.append(f"{path}:{idx}: line too long ({len(line)})")
        try:
            py_compile.compile(str(path), doraise=True)
        except py_compile.PyCompileError as exc:
            errors.append(f"{path}: compile error: {exc}")

    if errors:
        for err in errors:
            print(err)
        return 1

    print("lint ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
