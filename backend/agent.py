"""
Agentic multi-step RAG (Phase 6) - the core differentiator.

Single-step RAG (Phase 3) retrieves ONCE for the whole question. That works for
simple questions but struggles with complex ones ("compare X and Y", "what did
they do AND what was the impact") because one embedding can't capture several
distinct information needs.

The agentic loop reasons in steps instead:

  1. DECOMPOSE  - Claude splits the question into focused sub-questions.
  2. RETRIEVE   - we run semantic search for EACH sub-question and merge the
                  results (deduping chunks retrieved by more than one).
  3. SYNTHESIZE - Claude writes one final, cited answer over all that context.

This is still plain Python orchestrating Claude + Pinecone - no framework.
"""

import json

import config
import embeddings
import rag
import vector_store

# Ask Claude to plan. Structured outputs guarantee a valid JSON object back.
DECOMPOSE_SYSTEM = """You are the planning step of a research assistant. Break the user's \
question into 2-4 focused sub-questions that, answered together, fully answer the original. \
Each sub-question should target a single, distinct information need. If the question is \
already simple and atomic, return it unchanged as a single sub-question."""

_DECOMPOSE_SCHEMA = {
    "type": "object",
    "properties": {
        "sub_questions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["sub_questions"],
    "additionalProperties": False,
}


def decompose(question: str, max_subs: int = 4) -> list[str]:
    """Split a question into sub-questions. Falls back to [question] on any error."""
    client = rag._get_client()
    try:
        response = client.messages.create(
            model=config.ANSWER_MODEL,
            max_tokens=512,
            system=DECOMPOSE_SYSTEM,
            messages=[{"role": "user", "content": question}],
            output_config={
                "format": {"type": "json_schema", "schema": _DECOMPOSE_SCHEMA}
            },
        )
        text = "".join(b.text for b in response.content if b.type == "text")
        subs = json.loads(text).get("sub_questions", [])
    except Exception:
        # If structured outputs aren't available, don't fail the whole request -
        # just treat it as a single-step question.
        subs = []

    subs = [s.strip() for s in subs if isinstance(s, str) and s.strip()]
    return subs[:max_subs] or [question]


def gather_context(sub_questions: list[str], top_k: int = 4) -> list[dict]:
    """Retrieve chunks for every sub-question and merge, deduping by chunk id."""
    best: dict[str, dict] = {}
    for sq in sub_questions:
        vec = embeddings.embed_query(sq)
        for match in vector_store.search(vec, top_k=top_k):
            mid = match["id"]
            # Keep the highest score if the same chunk is retrieved twice.
            if mid not in best or match["score"] > best[mid]["score"]:
                best[mid] = match
    return sorted(best.values(), key=lambda c: c["score"], reverse=True)


def stream_agentic_answer(question: str, top_k: int = 4):
    """Generator for the agentic flow (Phase 6).

    Yields (event_type, payload):
      ("plan", [sub-questions])   the decomposition, so the UI can show reasoning
      ("sources", [...])          the merged, deduped chunks used as context
      ("token", "...")            the synthesized answer, streamed
      ("done", "")
    """
    # 1. DECOMPOSE
    sub_questions = decompose(question)
    yield ("plan", sub_questions)

    # 2. RETRIEVE for each sub-question, merged
    chunks = gather_context(sub_questions, top_k=top_k)
    yield ("sources", rag._sources_from_chunks(chunks))

    if not chunks:
        yield ("token", "No documents have been indexed yet. Upload a PDF first.")
        yield ("done", "")
        return

    # 3. SYNTHESIZE over all gathered context (same grounding + citation rules).
    context = rag._build_context(chunks)
    sub_list = "\n".join(f"- {s}" for s in sub_questions)
    user_message = (
        f"CONTEXT:\n{context}\n\n"
        f"The user's ORIGINAL QUESTION: {question}\n\n"
        f"You decomposed it into these sub-questions:\n{sub_list}\n\n"
        f"Now write one coherent, cited answer to the ORIGINAL QUESTION using the CONTEXT."
    )

    client = rag._get_client()
    with client.messages.stream(
        model=config.ANSWER_MODEL,
        max_tokens=1500,
        system=rag.SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        for text in stream.text_stream:
            yield ("token", text)

    yield ("done", "")
