# Docent

An **agentic research assistant**. Ask a complex question and Docent decomposes it into
sub-questions, retrieves from your uploaded documents **and** the live web, reasons across
the sources, and streams back a **structured, cited answer** you can trace to its origin.

> Not a "chat with your PDF" tool. The differentiator is **multi-step agentic reasoning**
> over **multiple sources** (documents + web) with **inline citations** — built on a
> hand-rolled RAG pipeline (no LangChain / LlamaIndex) to keep the mechanics explicit.

**Live:** [app](https://agentic-research-assistant-nine.vercel.app) · frontend on Vercel,
backend on Render (free tier — the first request after idle is slow while it wakes).

---

## How it works

```
Next.js frontend  → (HTTP / SSE)  →  FastAPI backend  →  Pinecone + Voyage + Claude + Tavily
```

The frontend and backend are **two separate services** that talk over HTTP — a deliberate
choice (over Next.js API routes) to exercise the real two-service pattern.

**Query flow (agentic mode):**

1. **Plan** — Claude decomposes the question into 2–4 sub-questions and routes each to
   `docs`, `web`, or `both` (structured outputs).
2. **Retrieve** — per sub-question: semantic search in Pinecone (Voyage `voyage-3`
   embeddings, cosine) and/or a Tavily web search. Results are merged, deduped, and ranked.
3. **Synthesize** — Claude writes one grounded answer over all context, citing sources
   inline as `[n]`.
4. **Stream** — plan → sources → answer tokens stream to the UI over SSE.

**Ingest flow:** upload a PDF → extract text → chunk (1000 chars, 200 overlap) → embed →
upsert vectors + metadata to Pinecone.

---

## Stack

| Layer        | Choice                                            |
| ------------ | ------------------------------------------------- |
| Frontend     | Next.js (App Router) + TypeScript + Tailwind CSS  |
| Backend      | Python + FastAPI (async, Pydantic)                |
| LLM          | Claude (Anthropic API)                            |
| Embeddings   | Voyage AI (`voyage-3`, 1024-dim)                  |
| Vector DB    | Pinecone (serverless, cosine)                     |
| Web search   | Tavily                                            |
| RAG logic    | **Plain Python — no LangChain / LlamaIndex**      |
| Deploy       | Vercel (frontend) + Render (backend)              |

---

## Features

- 📄 **Document library** — upload, list, and delete PDFs (deletes also purge the vectors).
- 🔎 **Semantic search** — inspect the raw retrieval layer: chunks ranked by cosine similarity.
- 🧠 **Agentic answers** — decompose → route → retrieve → synthesize, streamed token-by-token.
- 🌐 **Multi-source** — the agent decides per sub-question whether to use documents, the web, or both.
- 🔗 **Citations** — every claim carries an `[n]` marker linked to a numbered source (📄 doc / 🌐 web).
- 💬 **Chat history** — follow-ups reuse recent turns so pronouns/references resolve.
- 🌗 **Light / dark theme** with no flash on load.
- 🔐 **Google sign-in (optional)** — Auth.js/NextAuth v5; gates `/app` and shows a user menu when configured, fully dormant otherwise.

---

## Repository layout

```
frontend/   Next.js app (App Router). Landing at "/", the app at "/app".
backend/    FastAPI service: RAG pipeline, endpoints, chunking, vector store, agent.
```

Key backend modules: `main.py` (endpoints), `chunking.py`, `embeddings.py` (Voyage),
`vector_store.py` (Pinecone), `rag.py` (single-step RAG), `agent.py` (agentic multi-source),
`web_search.py` (Tavily), `config.py` (env + readiness checks).

---

## Running locally

You need two terminals. API keys live **only** in the backend environment.

**Backend** (from `backend/`):

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then fill in the keys below
uvicorn main:app --reload --port 8000
```

**Frontend** (from `frontend/`):

```bash
npm install
# frontend/.env.local:
#   NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                      # http://localhost:3000
```

### Backend environment variables

| Variable            | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Claude (planning + synthesis)                        |
| `VOYAGE_API_KEY`    | Embeddings                                           |
| `PINECONE_API_KEY`  | Vector store                                         |
| `TAVILY_API_KEY`    | Web search (optional — degrades to docs-only)        |
| `FRONTEND_ORIGINS`  | Comma-separated CORS origins (default `http://localhost:3000`) |
| `ANSWER_MODEL`      | Override the answer model (e.g. `claude-haiku-4-5`)  |

The app **degrades gracefully** without keys: upload + chunking still work, and `/status`
drives an "add keys" banner while embedding/search/answer endpoints return `503`.

### Google sign-in (optional, frontend)

Auth is off until you add Google OAuth credentials — the app is open to everyone until then.
To enable it, set these in `frontend/.env.local` (server-side only):

| Variable             | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `AUTH_SECRET`        | Session-cookie encryption key (`openssl rand -base64 32`)       |
| `AUTH_GOOGLE_ID`     | OAuth client ID (Google Cloud Console → Credentials)           |
| `AUTH_GOOGLE_SECRET` | OAuth client secret                                            |

Authorized redirect URI in Google Console: `http://localhost:3000/api/auth/callback/google`
(and the Vercel URL for prod). Once set, `/app` requires sign-in and the sidebar shows a
user menu. (Protecting the FastAPI backend with the session token is a planned follow-up.)

---

## API (backend)

| Method | Endpoint             | Purpose                                             |
| ------ | -------------------- | --------------------------------------------------- |
| GET    | `/health`            | Liveness                                            |
| GET    | `/status`            | Which capabilities are configured (drives the UI)   |
| POST   | `/upload`            | PDF → extract → chunk → embed → upsert              |
| GET    | `/documents`         | List uploaded documents                             |
| DELETE | `/documents/{id}`    | Remove a document and its vectors                   |
| POST   | `/search`            | Semantic search over chunks                         |
| POST   | `/ask/stream`        | Single-step RAG, streamed (SSE)                     |
| POST   | `/ask/agentic`       | Agentic multi-source answer, streamed (SSE)         |

---

## Why plain Python (no LangChain)

The RAG pipeline is built from scratch so every step — chunking, embedding, retrieval,
decomposition, source routing, citation numbering, synthesis — is explicit and inspectable,
rather than hidden behind a framework abstraction.
