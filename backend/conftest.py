"""Shared pytest fixtures. Run from backend/: `python -m pytest`.

We set a small search rate limit BEFORE importing the app, because slowapi bakes
each endpoint's limit into its decorator at import time.
"""

import os

# Small limit so the rate-limit test trips in a few calls (real default is 40/min).
os.environ.setdefault("RATE_LIMIT_SEARCH", "5/minute")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    return TestClient(main.app)


@pytest.fixture(autouse=True)
def _no_rate_limit():
    """Most tests shouldn't be throttled; the rate-limit test re-enables it."""
    main.limiter.enabled = False
    yield
    main.limiter.enabled = True
