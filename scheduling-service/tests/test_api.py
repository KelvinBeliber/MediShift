import importlib
import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_with_api_key(monkeypatch):
    monkeypatch.setenv("SCHEDULING_SERVICE_API_KEY", "test-key-123")
    import app.main as main_module

    importlib.reload(main_module)  # re-read the env var into the module-level API_KEY
    return TestClient(main_module.app)


@pytest.fixture
def client_without_api_key(monkeypatch):
    # NOTE: must be set to "" rather than deleted — main.py's load_dotenv()
    # call re-runs on every reload and repopulates any var that's genuinely
    # *absent* from os.environ (dotenv only skips vars already present, even
    # if empty), which would silently undo a monkeypatch.delenv() here since
    # the local .env file defines a real SCHEDULING_SERVICE_API_KEY.
    monkeypatch.setenv("SCHEDULING_SERVICE_API_KEY", "")
    import app.main as main_module

    importlib.reload(main_module)
    return TestClient(main_module.app)


def minimal_payload():
    return {
        "scheduleId": "s1",
        "startDate": "2030-01-01",
        "endDate": "2030-01-01",
        "shifts": [],
        "employees": [],
    }


class TestHealth:
    def test_health_returns_ok(self, client_without_api_key):
        res = client_without_api_key.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}


class TestGenerateEndpoint:
    def test_generate_works_with_no_api_key_configured(self, client_without_api_key):
        res = client_without_api_key.post("/generate", json=minimal_payload())
        assert res.status_code == 200
        assert res.json()["status"] == "OPTIMAL"

    def test_generate_rejects_missing_api_key_when_one_is_configured(self, client_with_api_key):
        res = client_with_api_key.post("/generate", json=minimal_payload())
        assert res.status_code == 401

    def test_generate_rejects_wrong_api_key(self, client_with_api_key):
        res = client_with_api_key.post("/generate", json=minimal_payload(), headers={"X-API-Key": "wrong"})
        assert res.status_code == 401

    def test_generate_accepts_correct_api_key(self, client_with_api_key):
        res = client_with_api_key.post("/generate", json=minimal_payload(), headers={"X-API-Key": "test-key-123"})
        assert res.status_code == 200

    def test_generate_rejects_malformed_payload(self, client_without_api_key):
        res = client_without_api_key.post("/generate", json={"scheduleId": "s1"})  # missing required fields
        assert res.status_code == 422


def teardown_module():
    # Leave the module in a clean state for any test run after this file.
    os.environ.pop("SCHEDULING_SERVICE_API_KEY", None)
