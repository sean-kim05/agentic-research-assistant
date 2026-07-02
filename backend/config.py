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

# Values that mean "still a placeholder / not set". If the env var equals one
# of these, we treat the corresponding service as NOT configured.
_PLACEHOLDERS = {
    "",
    "your-voyage-key-here",
    "your-pinecone-key-here",
    "changeme",
    "todo",
}

# --- Embedding settings ---------------------------------------------------
EMBED_MODEL = "voyage-3"
EMBED_DIM = 1024  # voyage-3 produces 1024-dimensional vectors

# --- Pinecone settings ----------------------------------------------------
PINECONE_INDEX = os.getenv("PINECONE_INDEX", "research-assistant").strip()
PINECONE_CLOUD = os.getenv("PINECONE_CLOUD", "aws").strip()
PINECONE_REGION = os.getenv("PINECONE_REGION", "us-east-1").strip()


def voyage_ready() -> bool:
    """True once a real Voyage API key is present."""
    return VOYAGE_API_KEY.lower() not in _PLACEHOLDERS


def pinecone_ready() -> bool:
    """True once a real Pinecone API key is present."""
    return PINECONE_API_KEY.lower() not in _PLACEHOLDERS
