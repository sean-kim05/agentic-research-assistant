"""
FastAPI backend - Agentic Research Assistant.

Phase 0: GET /health proves the frontend can reach this backend.
Phase 1: POST /upload receives a PDF, extracts its text, and splits it into
         overlapping chunks (stored in memory for now, no database yet).
"""

import io
import os
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader

from chunking import chunk_text

# Load variables from backend/.env into the process environment.
load_dotenv()

# Which frontend origin(s) may call this API *from the browser*.
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Chunking configuration (Phase 1). Tweak these to see how retrieval-sized
# pieces change.
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# In-memory document store: { filename: [chunk, chunk, ...] }.
# Phase 1 only - this is replaced by Pinecone (a real vector DB) in Phase 2.
UPLOADED_DOCUMENTS: dict[str, list[str]] = {}

app = FastAPI(title="Agentic Research Assistant API", version="0.1.0")

# --- CORS -----------------------------------------------------------------
# A browser BLOCKS a page from localhost:3000 from reading responses off a
# different origin (localhost:8000) unless the server opts in with these
# headers. See GET /health for the Phase 0 explanation.
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
    """Shape of the JSON returned by GET /health (validated by Pydantic)."""

    status: str
    service: str
    message: str


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness check the frontend calls to prove the connection works."""
    return HealthResponse(
        status="ok",
        service="agentic-research-assistant-backend",
        message="Backend is alive and reachable from the frontend!",
    )


# ==========================================================================
# Phase 1 - upload, extract text, chunk
# ==========================================================================
class Chunk(BaseModel):
    """One text chunk produced from an uploaded document."""

    id: int
    text: str
    char_count: int


class UploadResponse(BaseModel):
    """Result of processing an uploaded PDF."""

    filename: str
    num_pages: int
    num_chars: int
    chunk_size: int
    overlap: int
    num_chunks: int
    chunks: List[Chunk]


@app.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)) -> UploadResponse:
    """Receive a PDF, extract its text, and split it into overlapping chunks.

    Steps:
      1. Validate it's a PDF.
      2. Read the raw bytes and parse pages with pypdf.
      3. Concatenate the per-page text into one string.
      4. Chunk it (see chunking.py) and store the chunks in memory.
    """
    # 1. Basic validation.
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a .pdf file.")

    # 2. Read bytes into memory and parse. UploadFile.read() is async because
    #    the file may stream in over the network.
    raw = await file.read()
    try:
        reader = PdfReader(io.BytesIO(raw))
    except Exception as exc:  # malformed / not really a PDF
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {exc}")

    # 3. Extract text page by page. Some PDFs are scanned images with no text
    #    layer - extract_text() returns "" for those.
    pages_text = [page.extract_text() or "" for page in reader.pages]
    full_text = "\n\n".join(pages_text)

    if not full_text.strip():
        raise HTTPException(
            status_code=422,
            detail="No extractable text found. Is this a scanned/image-only PDF?",
        )

    # 4. Chunk and store.
    pieces = chunk_text(full_text, CHUNK_SIZE, CHUNK_OVERLAP)
    UPLOADED_DOCUMENTS[file.filename] = pieces

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
    )
