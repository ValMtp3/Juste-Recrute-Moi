from __future__ import annotations

import asyncio
import subprocess
import sys
from pathlib import Path

from api.routers import settings as settings_router
from data.sqlite.settings import validate_setting


REPO_ROOT = Path(__file__).resolve().parents[2]


def run_script(script: str):
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr


def test_invalid_integer_setting_rejects_text():
    ok, message = validate_setting("x_max_requests_per_scan", "banana")
    assert not ok
    assert "must be a number" in message


def test_invalid_integer_setting_rejects_out_of_range():
    ok, message = validate_setting("x_max_requests_per_scan", "999")
    assert not ok
    assert "between 1 and 50" in message


def test_valid_integer_setting_saves(tmp_path):
    db_path = str(tmp_path / "settings.db")
    run_script(
        "import sys;"
        "sys.path.insert(0, 'backend');"
        "from data.sqlite.connection import close_all;"
        "from data.sqlite.settings import get_settings, save_settings;"
        f"db_path = {db_path!r};"
        "save_settings({'x_max_requests_per_scan': '10'}, db_path);"
        "assert get_settings(db_path)['x_max_requests_per_scan'] == '10';"
        "close_all();"
    )


def test_unknown_setting_keys_remain_forward_compatible(tmp_path):
    db_path = str(tmp_path / "settings.db")
    run_script(
        "import sys;"
        "sys.path.insert(0, 'backend');"
        "from data.sqlite.connection import close_all;"
        "from data.sqlite.settings import get_settings, save_settings;"
        f"db_path = {db_path!r};"
        "save_settings({'future_setting': 'anything'}, db_path);"
        "assert get_settings(db_path)['future_setting'] == 'anything';"
        "close_all();"
    )


def test_invalid_setting_payload_raises(tmp_path):
    db_path = str(tmp_path / "settings.db")
    script = (
        "import sys;"
        "sys.path.insert(0, 'backend');"
        "from data.sqlite.settings import save_settings;"
        f"db_path = {db_path!r};"
        "save_settings({'board_scan_batch_size': '99'}, db_path);"
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode != 0
    assert "between 1 and 12" in result.stderr


def test_deepseek_key_probe_uses_deepseek_models_endpoint(monkeypatch):
    import httpx

    calls = []

    class FakeResponse:
        status_code = 200

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, headers=None):
            calls.append((url, headers))
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)

    result = asyncio.run(settings_router.probe_provider_key("deepseek", "sk-deepseek-test"))

    assert result["status"] == "ok"
    assert calls == [
        (
            "https://api.deepseek.com/models",
            {"Authorization": "Bearer sk-deepseek-test"},
        )
    ]


def test_validate_provider_settings_uses_pending_deepseek_key(monkeypatch):
    from llm import _ENV_NAMES

    for env_name in {*_ENV_NAMES.values(), "GOOGLE_API_KEY"}:
        monkeypatch.delenv(env_name, raising=False)

    calls = {}

    class FakeSettings:
        def get_settings(self):
            return {
                "gemini_api_key": "saved-gemini-key",
                "deepseek_api_key": "",
            }

    class FakeRepo:
        settings = FakeSettings()

    async def fake_probe(provider, key, settings):
        calls[provider] = key
        return {"status": "ok", "latency_ms": 1}

    monkeypatch.setattr(settings_router, "probe_provider_key", fake_probe)

    result = asyncio.run(
        settings_router.validate_provider_settings(
            FakeRepo(),
            {
                "llm_provider": "deepseek",
                "deepseek_api_key": "typed-deepseek-key",
                "gemini_api_key": settings_router.MASK,
            },
        )
    )

    assert calls["deepseek"] == "typed-deepseek-key"
    assert calls["gemini"] == "saved-gemini-key"
    assert result["deepseek"]["status"] == "ok"


def test_france_travail_settings_are_sensitive():
    keys = settings_router.sensitive_keys({
        "france_travail_client_id": "id",
        "france_travail_client_secret": "secret",
    })

    assert "france_travail_client_id" in keys
    assert "france_travail_client_secret" in keys
