from __future__ import annotations

from app.config import load_settings
from app.server import run_server


if __name__ == "__main__":
    run_server(load_settings())
