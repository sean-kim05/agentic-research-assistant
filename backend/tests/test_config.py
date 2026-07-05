"""Config readiness + placeholder detection."""

import config


def test_voyage_placeholder_detection(monkeypatch):
    monkeypatch.setattr(config, "VOYAGE_API_KEY", "")
    assert config.voyage_ready() is False
    monkeypatch.setattr(config, "VOYAGE_API_KEY", "changeme")  # a known placeholder
    assert config.voyage_ready() is False
    monkeypatch.setattr(config, "VOYAGE_API_KEY", "pa-real-voyage-key-123")
    assert config.voyage_ready() is True


def test_api_auth_enabled_toggles_with_secret(monkeypatch):
    monkeypatch.setattr(config, "BACKEND_API_SECRET", "")
    assert config.api_auth_enabled() is False
    monkeypatch.setattr(config, "BACKEND_API_SECRET", "s3cret")
    assert config.api_auth_enabled() is True
