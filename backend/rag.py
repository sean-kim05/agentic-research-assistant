"""
Single-step RAG (Phase 3).

THE CORE IDEA OF RAG:
An LLM only knows what was in its training data. To answer questions about YOUR
documents, we "augment" its prompt with relevant text we retrieved ourselves:

  question -> embed -> search Pinecone -> take the top chunks -> put them in the
  prompt as CONTEXT -> ask Claude to answer using ONLY that context.

That's "Retrieval-Augmented Generation": retrieval (Pinecone) feeds generation
(Claude). Grounding the answer in retrieved text is what keeps the model from
making things up (hallucinating).
"""

import anthropic

import config
import embeddings
import vector_store

# The SYSTEM prompt sets the model's role and rules. Keeping the model strictly
# grounded in the provided context (and telling it to admit when the answer
# isn't there) is the main defense against hallucination.
SYSTEM_PROMPT = """You are a research assistant. Answer the user's QUESTION using ONLY the \
information in the provided CONTEXT, which are excerpts retrieved from the user's uploaded \
documents.

Rules:
- Base your answer strictly on the CONTEXT. Do not use outside knowledge or assumptions.
- If the CONTEXT does not contain enough information to answer, say exactly: "I couldn't \
find the answer to that in the uploaded documents." Do not guess.
- Be concise and specific; paraphrase the relevant parts.
- Cite your sources inline using their number in square brackets, e.g. [1] or [2][3], \
right after the claim they support. Only cite sources you actually used.
- Never invent facts, names, numbers, or sources."""

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    if not config.anthropic_ready():
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not configured. Add a real key to backend/.env."
        )
    global _client
    if _client is None:
        # timeout: a stuck upstream call fails in ~45s instead of the SDK's
        # 10-minute default (which shows up as an endpoint that returns 200 then
        # streams nothing). max_retries: transparently retry transient drops
        # like RemoteDisconnected / connection resets before surfacing an error.
        _client = anthropic.Anthropic(
            api_key=config.ANTHROPIC_API_KEY,
            timeout=45.0,
            max_retries=2,
        )
    return _client


def _build_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a labeled CONTEXT block for the prompt."""
    blocks = []
    for i, c in enumerate(chunks, start=1):
        label = f"[Source {i} - {c.get('doc_id')} chunk {c.get('chunk_index')}]"
        blocks.append(f"{label}\n{c.get('text', '')}")
    return "\n\n---\n\n".join(blocks)


def answer_question(question: str, top_k: int = 5) -> dict:
    """Retrieve relevant chunks and have Claude answer grounded in them.

    Returns {"answer": str, "chunks": list[dict]} — chunks are the retrieved
    context (used for citations in Phase 4).
    """
    # 1. RETRIEVE: embed the question, find the most similar stored chunks.
    query_vec = embeddings.embed_query(question)
    chunks = vector_store.search(query_vec, top_k=top_k)

    if not chunks:
        return {
            "answer": "No documents have been indexed yet. Upload a PDF first.",
            "chunks": [],
        }

    # 2. ASSEMBLE the prompt: retrieved chunks become CONTEXT, then the QUESTION.
    context = _build_context(chunks)
    user_message = f"CONTEXT:\n{context}\n\nQUESTION: {question}"

    # 3. GENERATE: Claude writes an answer grounded in the context.
    client = _get_client()
    response = client.messages.create(
        model=config.ANSWER_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    # response.content is a list of blocks; collect the text blocks.
    answer = "".join(block.text for block in response.content if block.type == "text")

    return {"answer": answer, "chunks": chunks}


def _sources_from_chunks(chunks: list[dict]) -> list[dict]:
    return [
        {
            "number": i,
            "doc_id": c.get("doc_id"),
            "chunk_index": c.get("chunk_index"),
            "score": c.get("score", 0.0),
            "text": c.get("text", ""),
        }
        for i, c in enumerate(chunks, start=1)
    ]


def stream_answer(question: str, top_k: int = 5):
    """Generator for streaming RAG (Phase 5).

    Yields (event_type, payload) tuples:
      ("sources", [...])  once, up front (retrieval finishes before generation)
      ("token", "...")    many times, as Claude streams the answer
      ("done", "")        once at the end
    The retrieval step is the same as answer_question; only generation streams.
    """
    query_vec = embeddings.embed_query(question)
    chunks = vector_store.search(query_vec, top_k=top_k)

    # Send the sources immediately so the UI can show them while the answer types.
    yield ("sources", _sources_from_chunks(chunks))

    if not chunks:
        yield ("token", "No documents have been indexed yet. Upload a PDF first.")
        yield ("done", "")
        return

    context = _build_context(chunks)
    user_message = f"CONTEXT:\n{context}\n\nQUESTION: {question}"

    client = _get_client()
    # messages.stream() yields text deltas as they're generated.
    with client.messages.stream(
        model=config.ANSWER_MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        for text in stream.text_stream:
            yield ("token", text)

    yield ("done", "")
