"""
Vector store via Pinecone (Phase 2).

Pinecone is a managed vector DATABASE. Instead of rows/columns, it stores
vectors (our embeddings) plus a little metadata, and can answer "which stored
vectors are most similar to THIS query vector?" extremely fast using
approximate nearest-neighbour search. We use cosine similarity (angle between
vectors) because that's the standard match for text embeddings.

The index is created lazily on first use (with the right dimension for
voyage-3). Everything raises a clear error if the Pinecone key isn't set yet.
"""

from pinecone import Pinecone, ServerlessSpec

from config import (
    EMBED_DIM,
    PINECONE_API_KEY,
    PINECONE_CLOUD,
    PINECONE_INDEX,
    PINECONE_REGION,
    pinecone_ready,
)

_pc: Pinecone | None = None
_index = None


def _get_index():
    if not pinecone_ready():
        raise RuntimeError(
            "PINECONE_API_KEY is not configured. Add a real key to backend/.env."
        )
    global _pc, _index
    if _index is None:
        _pc = Pinecone(api_key=PINECONE_API_KEY)
        # Create the index once if it doesn't exist yet.
        if not _pc.has_index(PINECONE_INDEX):
            _pc.create_index(
                name=PINECONE_INDEX,
                dimension=EMBED_DIM,
                metric="cosine",
                spec=ServerlessSpec(cloud=PINECONE_CLOUD, region=PINECONE_REGION),
            )
        _index = _pc.Index(PINECONE_INDEX)
    return _index


def upsert_chunks(
    doc_id: str, chunks: list[str], embeddings: list[list[float]]
) -> int:
    """Store each chunk's embedding + text in Pinecone. Returns count stored."""
    index = _get_index()
    vectors = [
        {
            "id": f"{doc_id}::chunk-{i}",
            "values": embedding,
            "metadata": {"doc_id": doc_id, "chunk_index": i, "text": text},
        }
        for i, (text, embedding) in enumerate(zip(chunks, embeddings))
    ]
    # Upsert in batches (Pinecone caps batch size).
    for start in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[start : start + 100])
    return len(vectors)


def delete_document(doc_id: str, num_chunks: int) -> int:
    """Delete all of a document's chunk vectors from Pinecone by their ids."""
    index = _get_index()
    ids = [f"{doc_id}::chunk-{i}" for i in range(num_chunks)]
    if ids:
        index.delete(ids=ids)
    return len(ids)


def search(query_embedding: list[float], top_k: int = 5) -> list[dict]:
    """Return the top_k most similar stored chunks for a query embedding."""
    index = _get_index()
    res = index.query(
        vector=query_embedding, top_k=top_k, include_metadata=True
    )
    matches = []
    for m in res.matches:
        meta = m.metadata or {}
        matches.append(
            {
                "id": m.id,
                "score": m.score,
                "doc_id": meta.get("doc_id"),
                "chunk_index": meta.get("chunk_index"),
                "text": meta.get("text", ""),
            }
        )
    return matches
