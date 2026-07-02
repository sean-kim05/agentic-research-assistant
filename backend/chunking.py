"""
Text chunking for RAG (Phase 1).

WHY CHUNKING EXISTS:
A whole document is too big to (a) embed as one vector meaningfully, or
(b) stuff into an LLM prompt. So we split the text into smaller "chunks".
Later, each chunk gets its own embedding and is retrieved independently, so
a question only pulls back the few chunks that are actually relevant.

TWO KNOBS:
- chunk_size: how many characters per chunk. Too big = each chunk covers many
  topics and retrieval gets noisy; too small = a single idea gets split across
  chunks and loses context.
- overlap: how many characters each chunk repeats from the end of the previous
  one. Overlap prevents a sentence/idea that lands on a chunk boundary from
  being cut in half and lost. Common starting point: ~10-20% of chunk_size.

We chunk by raw characters here to keep Phase 1 simple. (Later you could chunk
by tokens or sentences for smarter boundaries.)
"""


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    """Split `text` into overlapping fixed-size character windows.

    Returns a list of chunk strings (empty/whitespace-only chunks are skipped).
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0:
        raise ValueError("overlap must be >= 0")
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    text = text.strip()
    if not text:
        return []

    step = chunk_size - overlap  # how far the window slides each step
    chunks: list[str] = []
    start = 0
    while start < len(text):
        window = text[start : start + chunk_size].strip()
        if window:
            chunks.append(window)
        start += step

    return chunks
