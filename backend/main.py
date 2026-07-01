"""
FastAPI backend - Agentic Research Assistant.

Phase 0: a minimal skeleton whose only job is to prove that the Next.js
frontend can talk to this Python backend over HTTP. It exposes a single
GET /health endpoint that the frontend calls on load.
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load variables from backend/.env into the process environment.
load_dotenv()

# Which frontend origin(s) may call this API *from the browser*.
# Comma-separated; defaults to the Next.js dev server.
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app = FastAPI(title="Agentic Research Assistant API", version="0.0.1")

# --- CORS -----------------------------------------------------------------
# A browser will BLOCK a page served from one origin (http://localhost:3000)
# from reading responses off a different origin (http://localhost:8000)
# unless that server explicitly opts in. This middleware adds the opt-in
# headers (Access-Control-Allow-Origin, etc.) so the frontend fetch works.
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
