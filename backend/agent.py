"""
Agentic multi-step, multi-source RAG (Phases 6 + 7) - the core differentiator.

Single-step RAG (Phase 3) retrieves ONCE from the documents. The agentic loop
reasons in steps and pulls from TWO sources - your documents (Pinecone) and the
live web (Tavily):

  1. DECOMPOSE  - Claude splits the question into focused sub-questions AND, for
                  each, decides which source it needs: "docs", "web", or "both".
  2. RETRIEVE   - for each sub-question, semantic search over documents and/or a
                  Tavily web search, per Claude's choice. Results are merged and
                  deduped into one ranked set of sources.
  3. SYNTHESIZE - Claude writes one final, cited answer over all that context,
                  citing documents and web pages alike.

Still plain Python orchestrating Claude + Pinecone + Tavily - no framework.
"""

import json

import config
import embeddings
import rag
import vector_store
import web_search

# --- Step 1: decomposition + per-sub-question source routing ---------------
DECOMPOSE_SYSTEM = """You are the planning step of a research assistant that can search two \
sources: the user's UPLOADED DOCUMENTS and the LIVE WEB.

Break the user's question into 2-4 focused sub-questions. For EACH sub-question, choose the \
source most likely to answer it:
- "docs"  : answerable from the user's uploaded documents (their own content, resume, papers, etc.)
- "web"   : needs current or external information not in the documents (recent events, prices, definitions, comparisons to the outside world)
- "both"  : needs the documents AND the web

If the question is already simple and atomic, return a single sub-question."""

_DECOMPOSE_SCHEMA = {
    "type": "object",
    "properties": {
        "sub_questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "source": {"type": "string", "enum": ["docs", "web", "both"]},
                },
                "required": ["question", "source"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["sub_questions"],
    "additionalProperties": False,
}

# --- Step 3: synthesis prompt (documents + web, with citations) ------------
SYNTHESIS_SYSTEM = """You are a research assistant. Answer the user's question using ONLY the \
information in the provided CONTEXT, whose sources are excerpts from the user's uploaded \
documents and/or live web search results.

Rules:
- Base your answer strictly on the CONTEXT. Do not use outside knowledge or assumptions.
- Cite your sources inline using their number in square brackets, e.g. [1] or [2][3], right \
after the claim they support. Only cite sources you actually used.
- If the CONTEXT does not contain enough information to answer, say exactly: "I couldn't find \
the answer to that in the available sources." Do not guess.
- Be concise and specific; paraphrase the relevant parts.
- Never invent facts, names, numbers, or sources."""


def decompose(question: str, max_subs: int = 4) -> list[dict]:
    """Split into sub-questions, each tagged with a source. Falls back safely."""
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
        subs = []

    cleaned = []
    for s in subs:
        if isinstance(s, dict) and str(s.get("question", "")).strip():
            source = s.get("source", "docs")
            if source not in ("docs", "web", "both"):
                source = "docs"
            cleaned.append({"question": s["question"].strip(), "source": source})

    return cleaned[:max_subs] or [{"question": question, "source": "docs"}]


def gather_context(sub_items: list[dict], top_k: int = 4) -> list[dict]:
    """Retrieve from documents and/or the web per sub-question; merge + dedupe.

    Each returned item is a unified "source":
      doc  -> {id, kind:"doc", doc_id, chunk_index, score, text}
      web  -> {id, kind:"web", title, url, score, text}
    """
    web_ok = config.tavily_ready()
    best: dict[str, dict] = {}

    for item in sub_items:
        query = item["question"]
        # If web isn't configured, degrade gracefully to documents only.
        source = item.get("source", "docs")
        if not web_ok:
            source = "docs"

        if source in ("docs", "both"):
            vec = embeddings.embed_query(query)
            for m in vector_store.search(vec, top_k=top_k):
                key = f"doc:{m['id']}"
                cand = {
                    "id": key,
                    "kind": "doc",
                    "doc_id": m.get("doc_id"),
                    "chunk_index": m.get("chunk_index"),
                    "score": m.get("score", 0.0),
                    "text": m.get("text", ""),
                }
                if key not in best or cand["score"] > best[key]["score"]:
                    best[key] = cand

        if source in ("web", "both") and web_ok:
            for r in web_search.search_web(query, max_results=3):
                key = f"web:{r['url']}"
                cand = {
                    "id": key,
                    "kind": "web",
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "score": r.get("score", 0.0),
                    "text": r.get("content", ""),
                }
                if key not in best or cand["score"] > best[key]["score"]:
                    best[key] = cand

    return sorted(best.values(), key=lambda c: c["score"], reverse=True)


def _build_context(items: list[dict]) -> str:
    """Label each source so Claude can cite it; documents and web look different."""
    blocks = []
    for i, c in enumerate(items, start=1):
        if c["kind"] == "web":
            label = f"[Source {i} - web: {c.get('title')} ({c.get('url')})]"
        else:
            label = f"[Source {i} - document {c.get('doc_id')} chunk {c.get('chunk_index')}]"
        blocks.append(f"{label}\n{c.get('text', '')}")
    return "\n\n---\n\n".join(blocks)


def _sources_payload(items: list[dict]) -> list[dict]:
    """Shape the merged sources for the frontend (numbered to match citations)."""
    out = []
    for i, c in enumerate(items, start=1):
        s = {
            "number": i,
            "kind": c["kind"],
            "score": c.get("score", 0.0),
            "text": c.get("text", ""),
        }
        if c["kind"] == "web":
            s["title"] = c.get("title")
            s["url"] = c.get("url")
        else:
            s["doc_id"] = c.get("doc_id")
            s["chunk_index"] = c.get("chunk_index")
        out.append(s)
    return out


def stream_agentic_answer(question: str, top_k: int = 4):
    """Generator for the agentic, multi-source flow (Phases 6 + 7).

    Yields (event_type, payload):
      ("plan", [{question, source}])   the decomposition + source routing
      ("sources", [...])               merged, deduped doc + web sources
      ("token", "...")                 the synthesized answer, streamed
      ("done", "")
    """
    # 1. DECOMPOSE (+ route each sub-question to docs / web / both)
    sub_items = decompose(question)
    yield ("plan", sub_items)

    # 2. RETRIEVE across sources, merged
    items = gather_context(sub_items, top_k=top_k)
    yield ("sources", _sources_payload(items))

    if not items:
        yield ("token", "No sources found. Upload a PDF, or enable web search.")
        yield ("done", "")
        return

    # 3. SYNTHESIZE over all gathered context (grounded + cited).
    context = _build_context(items)
    sub_list = "\n".join(f"- {s['question']}  [{s['source']}]" for s in sub_items)
    user_message = (
        f"CONTEXT:\n{context}\n\n"
        f"The user's ORIGINAL QUESTION: {question}\n\n"
        f"You decomposed it into these sub-questions (with the source used):\n{sub_list}\n\n"
        f"Now write one coherent, cited answer to the ORIGINAL QUESTION using the CONTEXT."
    )

    client = rag._get_client()
    with client.messages.stream(
        model=config.ANSWER_MODEL,
        max_tokens=1500,
        system=SYNTHESIS_SYSTEM,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        for text in stream.text_stream:
            yield ("token", text)

    yield ("done", "")
