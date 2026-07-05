"""Endpoint tests: health/status, upload validation, the auth gate, rate limits.

These run without any external API keys — the protected endpoints reach their
503 "keys not configured" branch, which is enough to prove the gate and limiter
behave correctly independent of Voyage/Pinecone/Anthropic.
"""

import config
import main


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_status_returns_booleans(client):
    r = client.get("/status")
    assert r.status_code == 200
    body = r.json()
    for key in ("voyage_ready", "pinecone_ready", "anthropic_ready", "web_search_ready"):
        assert isinstance(body[key], bool)


def test_upload_rejects_non_pdf(client):
    r = client.post("/upload", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_gate_open_when_no_secret(client, monkeypatch):
    monkeypatch.setattr(config, "BACKEND_API_SECRET", "")
    # Gate open -> we reach the handler, which 503s (no external keys). Not 401.
    r = client.post("/search", json={"query": "hi", "top_k": 3})
    assert r.status_code != 401


def test_gate_blocks_without_or_with_wrong_key(client, monkeypatch):
    monkeypatch.setattr(config, "BACKEND_API_SECRET", "s3cret")
    assert client.post("/search", json={"query": "hi", "top_k": 3}).status_code == 401
    assert (
        client.post(
            "/search", json={"query": "hi", "top_k": 3}, headers={"X-API-Key": "wrong"}
        ).status_code
        == 401
    )


def test_gate_allows_correct_key(client, monkeypatch):
    monkeypatch.setattr(config, "BACKEND_API_SECRET", "s3cret")
    r = client.post(
        "/search", json={"query": "hi", "top_k": 3}, headers={"X-API-Key": "s3cret"}
    )
    # Correct key passes the gate; handler then 503s (no keys) — the point is NOT 401.
    assert r.status_code != 401


def test_rate_limit_returns_429(client, monkeypatch):
    monkeypatch.setattr(config, "BACKEND_API_SECRET", "")  # gate open
    main.limiter.enabled = True  # conftest disables it by default
    # RATE_LIMIT_SEARCH is "5/minute" in tests; the 6th+ call should be throttled.
    codes = [
        client.post("/search", json={"query": "hi", "top_k": 3}).status_code
        for _ in range(7)
    ]
    assert codes[0] != 429
    assert 429 in codes
