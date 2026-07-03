"""
Web search via Tavily (Phase 7).

Tavily is a search API built for LLMs: give it a query, get back clean, ranked
results (title, url, a content snippet, a relevance score) ready to drop into a
prompt. It's the web-search counterpart to what Pinecone does for our documents.
"""

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
    """Return web results for a query as [{title, url, content, score}]."""
    client = _get_client()
    response = client.search(
        query=query, max_results=max_results, search_depth="basic"
    )
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("content", ""),
            "score": r.get("score", 0.0),
        }
        for r in response.get("results", [])
    ]
