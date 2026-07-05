"""
Central config for the backend. Reads secrets/settings from environment
(loaded from backend/.env) and exposes helpers to tell whether the external
API keys have been filled in with REAL values yet.

This lets the app run with placeholder keys (you can still upload + chunk),
and cleanly report "keys not configured" instead of crashing when a Voyage /
Pinecone call is attempted.
"""

import os

from dotenv import load_dotenv

load_dotenv()

# --- API keys -------------------------------------------------------------
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY", "").strip()
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "").strip()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()

# Values that mean "still a placeholder / not set". If the env var equals one
# of these, we treat the corresponding service as NOT configured.
_PLACEHOLDERS = {
    "",
    "your-voyage-key-here",
    "your-pinecone-key-here",
    "your-anthropic-key-here",
    "your-tavily-key-here",
    "changeme",
    "todo",
}

# --- Embedding settings ---------------------------------------------------
EMBED_MODEL = "voyage-3"
EMBED_DIM = 1024  # voyage-3 produces 1024-dimensional vectors

# --- LLM (answer generation) settings -------------------------------------
# The model Claude uses to write the grounded answer. Default is the most
# capable Opus; set ANSWER_MODEL=claude-haiku-4-5 in .env for cheap testing.
ANSWER_MODEL = os.getenv("ANSWER_MODEL", "claude-opus-4-8").strip()

# --- Pinecone settings ----------------------------------------------------
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "research-assistant").strip()
PINECONE_CLOUD = os.getenv("PINECONE_CLOUD", "aws").strip()
PINECONE_REGION = os.getenv("PINECONE_REGION", "us-east-1").strip()

# --- Backend access control (optional) ------------------------------------
# When BACKEND_API_SECRET is set, the expensive/mutating endpoints require an
# "X-API-Key: <secret>" header (the Next.js proxy injects it server-side, so it
# never reaches the browser). When unset, those endpoints are open — the app
# behaves exactly as before. This lets us protect the public Render URL from
# anonymous key-burning without breaking the current deployment.
BACKEND_API_SECRET = os.getenv("BACKEND_API_SECRET", "").strip()

# --- Rate limits (per client IP) ------------------------------------------
# Generous defaults so normal use is never throttled; tune via env if needed.
# Format is slowapi/limits syntax, e.g. "20/minute", "5/second".
RATE_LIMIT_ASK = os.getenv("RATE_LIMIT_ASK", "20/minute").strip()
RATE_LIMIT_UPLOAD = os.getenv("RATE_LIMIT_UPLOAD", "10/minute").strip()
RATE_LIMIT_SEARCH = os.getenv("RATE_LIMIT_SEARCH", "40/minute").strip()
RATE_LIMIT_DEFAULT = os.getenv("RATE_LIMIT_DEFAULT", "120/minute").strip()


def voyage_ready() -> bool:
    """True once a real Voyage API key is present."""
    return VOYAGE_API_KEY.lower() not in _PLACEHOLDERS


def pinecone_ready() -> bool:
    """True once a real Pinecone API key is present."""
    return PINECONE_API_KEY.lower() not in _PLACEHOLDERS


def anthropic_ready() -> bool:
    """True once a real Anthropic (Claude) API key is present."""
    return ANTHROPIC_API_KEY.lower() not in _PLACEHOLDERS


def tavily_ready() -> bool:
    """True once a real Tavily (web search) API key is present."""
    return TAVILY_API_KEY.lower() not in _PLACEHOLDERS


def api_auth_enabled() -> bool:
    """True when the backend requires an X-API-Key on protected endpoints."""
    return bool(BACKEND_API_SECRET)
