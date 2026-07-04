"use client";

// Secondary tool (sidebar "Search chunks"): type a query, hit /search, and see
// the chunks closest in meaning by cosine similarity. Checks /status on mount so
// it can tell you when the embedding keys aren't configured yet.

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

const mono = "var(--font-geist-mono), monospace";
const serif = "var(--font-newsreader), Georgia, serif";

export default function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [ready, setReady] = useState<boolean | null>(null);

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          height: 56,
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
          background: "var(--topbar)",
          backdropFilter: "blur(12px)",
          gap: 10,
        }}
      >
        <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>
          Search chunks
        </span>
        <span style={{ fontFamily: mono, fontSize: 10.5, color: "var(--ink3)" }}>
          semantic · cosine similarity
        </span>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "28px 28px 40px" }}>
          <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.6, margin: "0 0 18px" }}>
            Find the chunks closest in meaning to your query — not just keyword matches.
            This is the raw retrieval layer behind agentic answers.
          </p>

          {ready === false && (
            <div
              style={{
                marginBottom: 18,
                padding: 14,
                borderRadius: 10,
                border: "1px solid var(--amber)",
                background: "var(--clay-soft)",
                fontSize: 13,
                color: "var(--ink2)",
              }}
            >
              Search is disabled until <code style={{ fontFamily: mono }}>VOYAGE_API_KEY</code> and{" "}
              <code style={{ fontFamily: mono }}>PINECONE_API_KEY</code> are set in{" "}
              <code style={{ fontFamily: mono }}>backend/.env</code> (then restart the backend).
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              background: "var(--surface)",
              border: "1px solid var(--line2)",
              borderRadius: 12,
              padding: "8px 8px 8px 14px",
              alignItems: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. what is chunk overlap?"
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "var(--ink)",
                fontFamily: "inherit",
                fontSize: 14,
                minWidth: 0,
              }}
            />
            <button
              onClick={handleSearch}
              disabled={!query.trim() || state.kind === "searching" || ready === false}
              style={{
                flexShrink: 0,
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 600,
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                cursor:
                  !query.trim() || state.kind === "searching" || ready === false
                    ? "not-allowed"
                    : "pointer",
                background: "var(--btn-bg)",
                color: "var(--btn-fg)",
                opacity: !query.trim() || state.kind === "searching" || ready === false ? 0.5 : 1,
              }}
            >
              {state.kind === "searching" ? "Searching…" : "Search"}
            </button>
          </div>

          {state.kind === "error" && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 10,
                border: "1px solid var(--danger-border)",
                background: "var(--danger-soft)",
                fontSize: 13,
                color: "var(--danger)",
              }}
            >
              {state.message}
            </div>
          )}

          {state.kind === "done" && (
            <div style={{ marginTop: 20 }}>
              {state.data.matches.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--ink3)" }}>
                  No matches yet — have you added a PDF to the Library?
                </p>
              )}
              {state.data.matches.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 13,
                    padding: "14px 2px",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <span style={{ flexShrink: 0, fontFamily: serif, fontSize: 15, color: "var(--clay)", width: 18 }}>
                    {i + 1}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                      <span style={{ fontFamily: mono, fontSize: 11, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.doc_id ?? "?"} · chunk #{m.chunk_index ?? "?"}
                      </span>
                      <span style={{ flexShrink: 0, fontFamily: mono, fontSize: 11, color: "var(--ink2)", fontVariantNumeric: "tabular-nums" }}>
                        {m.score.toFixed(3)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {m.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
