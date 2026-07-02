"""
Embeddings via Voyage AI (Phase 2).

WHAT AN EMBEDDING IS (plain terms):
An embedding is a list of numbers (a vector) that represents the *meaning* of a
piece of text. Texts with similar meaning get vectors that point in similar
directions, so "how do I reset my password" and "I forgot my login" land close
together even though they share few words. That's what makes SEMANTIC search
possible (vs. keyword search, which only matches exact words).

We use different `input_type`s for documents vs. queries ("asymmetric"
retrieval), which Voyage recommends for better search quality.
"""

import voyageai

from config import EMBED_MODEL, VOYAGE_API_KEY, voyage_ready

# Voyage allows up to 128 texts per embedding request.
_MAX_BATCH = 128

_client: voyageai.Client | None = None


def _get_client() -> voyageai.Client:
    if not voyage_ready():
        raise RuntimeError(
            "VOYAGE_API_KEY is not configured. Add a real key to backend/.env."
        )
    global _client
    if _client is None:
        _client = voyageai.Client(api_key=VOYAGE_API_KEY)
    return _client


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed a list of document chunks (batched to respect Voyage limits)."""
    client = _get_client()
    vectors: list[list[float]] = []
    for start in range(0, len(texts), _MAX_BATCH):
        batch = texts[start : start + _MAX_BATCH]
        result = client.embed(batch, model=EMBED_MODEL, input_type="document")
        vectors.extend(result.embeddings)
    return vectors


def embed_query(text: str) -> list[float]:
    """Embed a single search query."""
    client = _get_client()
    result = client.embed([text], model=EMBED_MODEL, input_type="query")
    return result.embeddings[0]
