# CLAUDE.md — Agentic Research Assistant

> **INSTRUCTION TO CLAUDE:** Read this file fully at the start of every session before doing any work. It is the source of truth for the project's state. At the end of any session with meaningful changes (new features, architecture decisions, dependencies added, build-order progress), UPDATE the "Current State", "Build Progress", and "Decisions Log" sections to reflect reality. If I say "update CLAUDE.md", refresh all relevant sections. Keep it accurate and concise. Do NOT let this file drift from what's actually built.

---

## Project Overview
An **agentic research assistant**. It answers complex research questions by:
1. Decomposing the question into sub-questions
2. Retrieving relevant info from an uploaded document corpus (RAG) AND live web search
3. Reasoning across the retrieved sources
4. Producing a **cited, structured answer**

**Differentiator vs. basic RAG:** multi-step agentic reasoning + multi-source (documents + web) + citations. This is intentionally more advanced than a plain "chat with your PDF" tool.

**Why this project exists:** learning project to master RAG + agentic patterns + FastAPI + Next.js, and to serve as a strong portfolio piece. The builder (Sean) must UNDERSTAND every part, not just generate it — he will be asked about this in interviews.

---

## Stack (industry-standard RAG stack)
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind — calls the backend over HTTP
- **Backend:** Python + FastAPI (a separate service from the frontend)
- **LLM:** Claude (Anthropic API)
- **Embeddings:** Voyage AI (voyage-3)
- **Vector DB:** Pinecone (starter/free tier)
- **Web search:** Tavily API (used in the agentic multi-source phase)
- **RAG logic:** PLAIN PYTHON — **NO LangChain / LlamaIndex.** This is deliberate: building the RAG pipeline from scratch to learn the fundamentals. Do not introduce these frameworks unless explicitly asked.
- **Metadata:** stored inside Pinecone for now (no separate metadata DB yet)
- **Deploy:** Vercel (frontend) + Railway or Render (FastAPI backend)

---

## Architecture (two services)

```
Next.js frontend  → (HTTP/JSON)  →  FastAPI backend  →  Pinecone + Voyage + Claude + Tavily
```

The frontend and backend are **separate services** that talk over HTTP. This is a deliberate choice (vs. Next.js API routes) to learn FastAPI and the two-service pattern.

**Data flow:**
1. **INGEST:** user uploads docs → FastAPI extracts text → chunks it → embeds chunks (Voyage) → stores vectors + metadata in Pinecone
2. **QUERY:** frontend sends the user's question to a FastAPI endpoint
3. **PLAN (agentic):** Claude decomposes the question into sub-questions
4. **RETRIEVE:** for each sub-question → semantic search in Pinecone + (later) Tavily web search
5. **SYNTHESIZE:** Claude combines all retrieved context → a cited, structured answer
6. **STREAM:** the answer streams back to the Next.js frontend, with source citations shown

---

## Current State
> Claude: keep this section updated to reflect what actually exists.

**As of 2026-07-02:** Phase 0 + Phase 1 COMPLETE and verified. Two-service monorepo:
- `frontend/` — Next.js 16 (App Router) + React 19 + TypeScript + Tailwind.
  - `src/app/page.tsx` is now a **Server Component** that composes two Client "island" components.
  - `src/app/_components/BackendStatus.tsx` — client badge; live `/health` check.
  - `src/app/_components/PdfUploader.tsx` — client; posts a PDF (multipart form-data) to `/upload` and renders the returned chunks + stats. Handles loading/error states.
  - `src/lib/api.ts` — shared `API_URL` (from `NEXT_PUBLIC_API_URL`).
- `backend/` — FastAPI service.
  - `main.py` exposes `GET /health` and `POST /upload` (extract PDF text → chunk → return, Pydantic-validated). In-memory `UPLOADED_DOCUMENTS` store (no DB yet). CORS allows the frontend origin.
  - `chunking.py` — `chunk_text(text, chunk_size=1000, overlap=200)`, character-based sliding window.
  - Deps in a venv (`backend/venv/`): fastapi, uvicorn, python-dotenv, pypdf, python-multipart.
- Single git repo at the project root. `PROMPTS.md` and all `.env`/`.env.local` files are gitignored.
- A separate throwaway learning scaffold lives OUTSIDE this project at `C:\Users\skim8\dev\learn-nextjs` (not part of this repo).

**Verified 2026-07-01:** backend `/health` returns JSON; frontend serves 200; CORS returns `Access-Control-Allow-Origin: http://localhost:3000`.
**Verified 2026-07-02:** `POST /upload` with a 1-page test PDF (1885 chars) returned 3 chunks `[1000, 1000, 285]` (overlap 200); a non-PDF upload correctly returned `400 {"detail": "Please upload a .pdf file."}`.

**Phase 2 COMPLETE (2026-07-02) — verified live end-to-end with real Voyage + Pinecone keys.**
- `backend/config.py` — central env config + `voyage_ready()` / `pinecone_ready()` (detects placeholder keys).
- `backend/embeddings.py` — Voyage `voyage-3` wrapper (`embed_documents` / `embed_query`, batched; input_type document vs query).
- `backend/vector_store.py` — Pinecone: lazy index create (dim 1024, cosine, serverless), `upsert_chunks`, `search`.
- `main.py` — `/upload` now embeds + upserts to Pinecone (best-effort; skipped with a clear message if keys are placeholders); new `POST /search` (503 until keys set) and `GET /status`.
- `frontend/src/app/_components/SemanticSearch.tsx` — query box; checks `/status`, shows an "add keys" banner when disabled; renders ranked matches with cosine scores.
- Deps added: `voyageai` (0.4.1), `pinecone` (9.1.0).
- **Verified without keys (2026-07-02):** all modules import; `/status` → both false; `/search` → 503; `/upload` → 3 chunks with `indexed:false` + explanatory message; frontend renders the search section.
- **Verified live (2026-07-02):** uploaded a PDF → 3 chunks embedded (voyage-3) + upserted to Pinecone index `research-assistant`; `/search` returns ranked matches with cosine scores (e.g. "how do embeddings capture meaning?" → the embeddings chunk at 0.64). Real keys live in `backend/.env` (gitignored).

### How to run both services locally
- **Backend** (from `backend/`): `venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000` → http://localhost:8000 (docs at `/docs`)
- **Frontend** (from `frontend/`): `npm run dev` → http://localhost:3000
- Run them in two separate terminals. Frontend reads the backend URL from `frontend/.env.local` (`NEXT_PUBLIC_API_URL`).

> NOTE: the project root folder is still named `next js` and will be renamed to `agentic-research-assistant` by Sean later. On Windows, the real Python is `py -3.14` / the `pythoncore-3.14-64` interpreter — the bare `python` command can hit the Microsoft Store alias.

---

## Build Progress (build IN ORDER — do not skip ahead)
> Build each phase fully and confirm it works before moving to the next. Do NOT try to build multiple phases at once. Check off completed phases.

- [x] **Phase 0 — Skeletons connected:** Minimal FastAPI backend with one test endpoint + minimal Next.js frontend that calls it and displays the response. Prove the frontend↔backend HTTP connection works locally. **DONE 2026-07-01.**
- [x] **Phase 1 — Upload & chunk (no AI):** File upload UI for PDFs. FastAPI endpoint that extracts the PDF text and splits it into chunks (fixed-size with overlap to start). Show the chunks. No embeddings yet. **DONE 2026-07-02.**
- [x] **Phase 2 — Embeddings & Pinecone:** Embed the chunks with Voyage, store vectors + metadata in Pinecone. Test semantic search: given a query, return the most similar chunks. **DONE 2026-07-02.**
- [ ] **Phase 3 — Basic RAG (single-step):** Question → embed → retrieve top chunks from Pinecone → pass them to Claude → return an answer grounded in the docs.
- [ ] **Phase 4 — Citations:** Return which chunks/sources each answer used, and display them in the frontend.
- [ ] **Phase 5 — Streaming:** Stream Claude's answer to the frontend token-by-token instead of waiting for the full response.
- [ ] **Phase 6 — AGENTIC upgrade:** Instead of single-step retrieve-then-answer, Claude first decomposes the question into sub-questions, retrieves for each, then synthesizes a final answer across all retrieved context. (This is the core differentiator.)
- [ ] **Phase 7 — Multi-source:** Add Tavily web search as an additional retrieval source alongside the document corpus. The agent decides when to use docs vs. web.
- [ ] **Phase 8 — Polish:** Chat history, document library (manage multiple docs), improved UI, error/loading states.

---

## Decisions Log
> Claude: record key technical decisions + brief rationale here so context persists across sessions.

- **Plain Python for RAG (no LangChain/LlamaIndex):** to learn RAG fundamentals directly and be able to explain them in interviews. Frameworks hide the mechanics.
- **Two-service architecture (Next.js + FastAPI):** rather than Next.js API routes, to learn FastAPI and the frontend↔backend HTTP pattern.
- **Pinecone + Voyage:** chosen for the vector DB and embeddings (both strong, both have free tiers; Voyage embeddings are high quality for retrieval).
- **Monorepo, single git repo at root (2026-06-30):** `frontend/` and `backend/` live side by side in one repository for simplicity.
- **PROMPTS.md kept private (2026-06-30):** gitignored so the personal build guide never lands on GitHub.
- **Phase 0 CORS + client-side fetch (2026-07-01):** the home page fetches `/health` from the browser (Client Component) on purpose, so CORS is genuinely exercised — configured `CORSMiddleware` in FastAPI to allow `http://localhost:3000`. Backend URL is injected via `NEXT_PUBLIC_API_URL`.
- **Phase 1 chunking = character-based sliding window (2026-07-02):** `chunk_size=1000`, `overlap=200` chars, step = 800. Chosen for simplicity/explainability; token- or sentence-based chunking is a later refinement. Chunking lives in its own `chunking.py` so it's easy to reason about and test in isolation.
- **Phase 1 in-memory store (2026-07-02):** uploaded chunks kept in a plain dict (`UPLOADED_DOCUMENTS`), no database — deliberately deferred to Phase 2 (Pinecone).
- **Frontend = Server Component page + Client islands (2026-07-02):** `page.tsx` stays a Server Component; only `BackendStatus` and `PdfUploader` are `"use client"`. Teaches the idiomatic Next.js server/client split.
- **Phase 2 modular design (2026-07-02):** embeddings (`embeddings.py`), vector store (`vector_store.py`), and config (`config.py`) are separate modules so each concern is testable and explainable in isolation.
- **Phase 2 graceful degradation with placeholder keys (2026-07-02):** the app runs with placeholder Voyage/Pinecone keys — upload + chunk still work; embedding/search are skipped (`/upload` returns `indexed:false`; `/search` → 503) with clear messages, and `GET /status` drives an "add keys" banner in the UI. Lets us build/verify the wiring before real keys exist.
- **Phase 2 vector settings (2026-07-02):** `voyage-3` embeddings (1024-dim), Pinecone serverless index (cosine, aws/us-east-1), asymmetric input types (document vs query), lazy index creation on first use.
- **Commits: no Claude attribution (2026-07-02):** commit messages are plain and do NOT include Claude/AI co-author or "generated with" trailers (Sean's preference).

---

## Conventions
- **API keys are server-side ONLY** — they live in the FastAPI backend's environment variables, NEVER in the Next.js frontend or exposed to the browser.
- **FastAPI:** use async endpoints; use Pydantic models for request/response validation.
- **One concern per endpoint** — keep endpoints focused.
- **TypeScript strict mode** on the frontend.
- **Explain new/complex concepts** when implementing them — the builder is learning RAG, FastAPI, and the two-service pattern, and needs to understand the code, not just receive it.
- Use a `.env` file for secrets; never commit real keys. Provide a `.env.example`.

---

## Known Issues / TODOs
> Claude: track open problems and follow-ups here.

- Root project folder still named `next js`; to be renamed to `agentic-research-assistant` by Sean (close IDE → rename → reopen).
- Pinecone free tier: index `research-assistant` (1024-dim, cosine, aws/us-east-1) is auto-created on first upload — no manual dashboard setup. New upserts take a few seconds to become queryable (eventual consistency).
- VS Code may show "package not installed" on backend imports — select the venv interpreter (`backend/venv/Scripts/python.exe`) via the Python: Select Interpreter command. Doesn't affect running the server.
- GitHub: `gh` authed as `sean-kim05`. Push to a remote as we go (see Decisions re: no Claude attribution in commits).
