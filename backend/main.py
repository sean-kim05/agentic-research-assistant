"""
FastAPI backend - Agentic Research Assistant.

Phase 0: GET /health proves the frontend can reach this backend.
Phase 1: POST /upload receives a PDF, extracts its text, chunks it.
Phase 2: on upload we also EMBED the chunks (Voyage) and store them in a vector
         DB (Pinecone); POST /search runs semantic search over stored chunks.
         GET /status reports whether the Voyage/Pinecone keys are configured.
"""

import io
import json
import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pypdf import PdfReader

import config
import embeddings
import rag
import vector_store
from chunking import chunk_text

load_dotenv()

FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Chunking configuration (Phase 1).
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# In-memory document store (Phase 1). Still handy for inspecting chunks even
# before vector indexing; Pinecone (Phase 2) is the real retrieval store.
UPLOADED_DOCUMENTS: dict[str, list[str]] = {}

app = FastAPI(title="Agentic Research Assistant API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================================================
# Phase 0 - health check
# ==========================================================================
class HealthResponse(BaseModel):
    status: str
    service: str
    message: str


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="agentic-research-assistant-backend",
        message="Backend is alive and reachable from the frontend!",
    )


# ==========================================================================
# Phase 2 - service configuration status
# ==========================================================================
class StatusResponse(BaseModel):
    voyage_ready: bool
    pinecone_ready: bool
    anthropic_ready: bool


@app.get("/status", response_model=StatusResponse)
async def status() -> StatusResponse:
    """Tell the frontend which capabilities are usable yet."""
    return StatusResponse(
        voyage_ready=config.voyage_ready(),
        pinecone_ready=config.pinecone_ready(),
        anthropic_ready=config.anthropic_ready(),
    )


# ==========================================================================
# Phase 1 + 2 - upload, extract text, chunk, embed, index
# ==========================================================================
class Chunk(BaseModel):
    id: int
    text: str
    char_count: int


class UploadResponse(BaseModel):
    filename: str
    num_pages: int
    num_chars: int
    chunk_size: int
    overlap: int
    num_chunks: int
    chunks: List[Chunk]
    indexed: bool           # were the chunks embedded + stored in Pinecone?
    index_message: str      # human-readable note about indexing


@app.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)) -> UploadResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a .pdf file.")

    raw = await file.read()
    try:
        reader = PdfReader(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {exc}")

    pages_text = [page.extract_text() or "" for page in reader.pages]
    full_text = "\n\n".join(pages_text)

    if not full_text.strip():
        raise HTTPException(
            status_code=422,
            detail="No extractable text found. Is this a scanned/image-only PDF?",
        )

    pieces = chunk_text(full_text, CHUNK_SIZE, CHUNK_OVERLAP)
    UPLOADED_DOCUMENTS[file.filename] = pieces

    # --- Phase 2: embed + index (best-effort) ---
    # If keys aren't set yet, we still return the chunks so you can inspect
    # them; indexing is simply skipped with a clear message.
    indexed = False
    if config.voyage_ready() and config.pinecone_ready():
        try:
            vecs = embeddings.embed_documents(pieces)
            stored = vector_store.upsert_chunks(file.filename, pieces, vecs)
            indexed = True
            index_message = f"Embedded and stored {stored} chunks in Pinecone."
        except Exception as exc:  # surface the real error without crashing
            index_message = f"Indexing failed: {exc}"
    else:
        missing = []
        if not config.voyage_ready():
            missing.append("VOYAGE_API_KEY")
        if not config.pinecone_ready():
            missing.append("PINECONE_API_KEY")
        index_message = (
            "Chunks shown but NOT indexed - missing "
            + " and ".join(missing)
            + " in backend/.env."
        )

    chunks = [
        Chunk(id=i, text=piece, char_count=len(piece))
        for i, piece in enumerate(pieces)
    ]

    return UploadResponse(
        filename=file.filename,
        num_pages=len(reader.pages),
        num_chars=len(full_text),
        chunk_size=CHUNK_SIZE,
        overlap=CHUNK_OVERLAP,
        num_chunks=len(chunks),
        chunks=chunks,
        indexed=indexed,
        index_message=index_message,
    )


# ==========================================================================
# Phase 2 - semantic search
# ==========================================================================
class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


class SearchMatch(BaseModel):
    id: str
    score: float
    doc_id: Optional[str] = None
    chunk_index: Optional[int] = None
    text: str


class SearchResponse(BaseModel):
    query: str
    matches: List[SearchMatch]


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest) -> SearchResponse:
    """Embed the query and return the most semantically similar stored chunks."""
    if not (config.voyage_ready() and config.pinecone_ready()):
        raise HTTPException(
            status_code=503,
            detail="Search unavailable: add VOYAGE_API_KEY and PINECONE_API_KEY "
            "to backend/.env, then restart the backend.",
        )
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    try:
        query_vec = embeddings.embed_query(req.query)
        results = vector_store.search(query_vec, top_k=req.top_k)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Search failed: {exc}")

    return SearchResponse(
        query=req.query,
        matches=[SearchMatch(**m) for m in results],
    )


# ==========================================================================
# Phase 3 - single-step RAG (retrieve + ask Claude)
# ==========================================================================
class AskRequest(BaseModel):
    question: str
    top_k: int = 5


class Source(BaseModel):
    """A retrieved chunk that was provided to Claude as context (Phase 4)."""

    number: int  # matches the inline [n] citations in the answer
    doc_id: Optional[str] = None
    chunk_index: Optional[int] = None
    score: float
    text: str


class AskResponse(BaseModel):
    question: str
    answer: str
    sources: List[Source]


@app.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    """Answer a question grounded in the retrieved document chunks + cite them."""
    if not (
        config.voyage_ready()
        and config.pinecone_ready()
        and config.anthropic_ready()
    ):
        raise HTTPException(
            status_code=503,
            detail="Ask unavailable: set VOYAGE_API_KEY, PINECONE_API_KEY, and "
            "ANTHROPIC_API_KEY in backend/.env, then restart the backend.",
        )
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    try:
        result = rag.answer_question(req.question, top_k=req.top_k)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Answer failed: {exc}")

    # Number the sources 1..N to match the inline [n] citations in the answer.
    sources = [
        Source(
            number=i,
            doc_id=c.get("doc_id"),
            chunk_index=c.get("chunk_index"),
            score=c.get("score", 0.0),
            text=c.get("text", ""),
        )
        for i, c in enumerate(result["chunks"], start=1)
    ]

    return AskResponse(question=req.question, answer=result["answer"], sources=sources)


# ==========================================================================
# Phase 5 - streaming RAG (Server-Sent Events)
# ==========================================================================
@app.post("/ask/stream")
async def ask_stream(req: AskRequest) -> StreamingResponse:
    """Same as /ask, but streams the answer token-by-token as SSE.

    Events: `sources` (once), `token` (many), `done` (once), `error` (on failure).
    """
    if not (
        config.voyage_ready()
        and config.pinecone_ready()
        and config.anthropic_ready()
    ):
        raise HTTPException(
            status_code=503,
            detail="Ask unavailable: set VOYAGE_API_KEY, PINECONE_API_KEY, and "
            "ANTHROPIC_API_KEY in backend/.env, then restart the backend.",
        )
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    def event_stream():
        # Each SSE message is "event: <type>\ndata: <json>\n\n".
        try:
            for event_type, payload in rag.stream_answer(
                req.question, top_k=req.top_k
            ):
                yield f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"
        except Exception as exc:  # surface errors as an SSE event, not a crash
            yield f"event: error\ndata: {json.dumps(str(exc))}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
