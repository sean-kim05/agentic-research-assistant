"""
Web search via Tavily (Phase 7).

Tavily is a search API built for LLMs: give it a query, get back clean, ranked
results (title, url, a content snippet, a relevance score) ready to drop into a
prompt. It's the web-search counterpart to what Pinecone does for our documents.
"""

import time

from tavily import TavilyClient

import config

_client: TavilyClient | None = None


def _get_client() -> TavilyClient:
    if not config.tavily_ready():
        raise RuntimeError(
            "TAVILY_API_KEY is not configured. Add a real key to backend/.env."
        )
    global _client
    if _client is None:
        _client = TavilyClient(api_key=config.TAVILY_API_KEY)
    return _client


def search_web(query: str, max_results: int = 3) -> list[dict]:
    """Return web results for a query as [{title, url, content, score}].

    Tavily runs on `requests`, so a flaky connection can raise a transient
    ``RemoteDisconnected`` / ``Connection aborted``. We retry a couple of times,
    and if it still fails we return [] (degrade to documents-only) rather than
    aborting the whole answer.
    """
    client = _get_client()
    response = None
    for attempt in range(3):
        try:
            response = client.search(
                query=query, max_results=max_results, search_depth="basic"
            )
            break
        except Exception:
            if attempt == 2:
                return []  # give up on web; the agent falls back to docs
            time.sleep(0.4 * (attempt + 1))

    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("content", ""),
            "score": r.get("score", 0.0),
        }
        for r in (response or {}).get("results", [])
    ]
