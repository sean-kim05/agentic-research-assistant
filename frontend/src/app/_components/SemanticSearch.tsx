"use client";

// Phase 2 UI: type a query, hit the backend's /search, and show the most
// semantically similar chunks (by cosine similarity score). Checks /status on
// mount so it can tell you when the API keys aren't configured yet.

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Match = {
  id: string;
  score: number;
  doc_id: string | null;
  chunk_index: number | null;
  text: string;
};

type SearchResponse = { query: string; matches: Match[] };

type State =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "error"; message: string }
  | { kind: "done"; data: SearchResponse };

export default function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [ready, setReady] = useState<boolean | null>(null);

  // Ask the backend whether embeddings + vector search are usable yet.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/status`)
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) setReady(Boolean(s.voyage_ready && s.pinecone_ready));
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    setState({ kind: "searching" });
    try {
      const res = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: 5 }),
      });
      if (!res.ok) {
        let detail = `Search failed (${res.status})`;
        try {
          const e = await res.json();
          if (e?.detail) detail = e.detail;
        } catch {
          // not JSON
        }
        throw new Error(detail);
      }
      const data = (await res.json()) as SearchResponse;
      setState({ kind: "done", data });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <section className="mt-10 border-t border-black/10 pt-8 dark:border-white/15">
      <h2 className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
        Semantic search
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Find the chunks closest in meaning to your query (not just keyword match).
      </p>

      {ready === false && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          Search is disabled until <code>VOYAGE_API_KEY</code> and{" "}
          <code>PINECONE_API_KEY</code> are set in <code>backend/.env</code>{" "}
          (then restart the backend).
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="e.g. what is chunk overlap?"
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-emerald-500 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || state.kind === "searching" || ready === false}
          className="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.kind === "searching" ? "Searching…" : "Search"}
        </button>
      </div>

      {state.kind === "error" && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {state.message}
        </div>
      )}

      {state.kind === "done" && (
        <div className="mt-4 space-y-3">
          {state.data.matches.length === 0 && (
            <p className="text-sm text-zinc-500">
              No matches yet — have you uploaded a PDF?
            </p>
          )}
          {state.data.matches.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900"
            >
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                <span className="font-medium">
                  {m.doc_id ?? "?"} · chunk #{m.chunk_index ?? "?"}
                </span>
                <span>score {m.score.toFixed(3)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-300">
                {m.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
