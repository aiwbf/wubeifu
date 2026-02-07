from __future__ import annotations

import os
import unittest

from app.config import load_settings


class ConfigTests(unittest.TestCase):
    def test_load_default_settings(self) -> None:
        os.environ.pop("WXA_API_TOKEN", None)
        os.environ.pop("WXA_PORT", None)
        settings = load_settings()
        self.assertEqual(settings.api_token, "dev-token")
        self.assertEqual(settings.port, 8080)

    def test_load_custom_values(self) -> None:
        os.environ["WXA_API_TOKEN"] = "abc"
        os.environ["WXA_PORT"] = "9099"
        os.environ["WXA_RATE_LIMIT"] = "50"
        settings = load_settings()
        self.assertEqual(settings.api_token, "abc")
        self.assertEqual(settings.port, 9099)
        self.assertEqual(settings.rate_limit_per_minute, 50)

    def test_missing_required_fails(self) -> None:
        os.environ["WXA_API_TOKEN"] = ""
        with self.assertRaises(ValueError):
            load_settings()
        os.environ.pop("WXA_API_TOKEN", None)


if __name__ == "__main__":
    unittest.main()
