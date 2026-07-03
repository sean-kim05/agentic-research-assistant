"use client";

// Phase 3-7 UI: ask a question -> grounded, cited answer, streamed live.
// Agentic mode (/ask/agentic) decomposes the question into sub-questions, routes
// each to documents and/or the web, then synthesizes one cited answer.

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type PlanItem = { question: string; source: string };

type Source = {
  number: number;
  kind: "doc" | "web";
  score: number;
  text: string;
  doc_id?: string | null;
  chunk_index?: number | null;
  title?: string | null;
  url?: string | null;
};

type State =
  | { kind: "idle" }
  | { kind: "streaming"; answer: string; sources: Source[]; plan: PlanItem[] }
  | { kind: "error"; message: string }
  | { kind: "done"; answer: string; sources: Source[]; plan: PlanItem[] };

export default function AskAssistant() {
  const [question, setQuestion] = useState("");
  const [agentic, setAgentic] = useState(true);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [ready, setReady] = useState<boolean | null>(null);
  const [webReady, setWebReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/status`)
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) {
          setReady(
            Boolean(s.voyage_ready && s.pinecone_ready && s.anthropic_ready),
          );
          setWebReady(Boolean(s.web_search_ready));
        }
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAsk() {
    if (!question.trim()) return;
    setState({ kind: "streaming", answer: "", sources: [], plan: [] });

    const endpoint = agentic ? "/ask/agentic" : "/ask/stream";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, top_k: agentic ? 4 : 5 }),
      });
      if (!res.ok || !res.body) {
        let detail = `Ask failed (${res.status})`;
        try {
          const e = await res.json();
          if (e?.detail) detail = e.detail;
        } catch {
          // not JSON
        }
        throw new Error(detail);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let sources: Source[] = [];
      let plan: PlanItem[] = [];

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const records = buffer.split("\n\n");
        buffer = records.pop() ?? "";

        for (const record of records) {
          if (!record.trim()) continue;
          let event = "message";
          let data = "";
          for (const line of record.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (event === "plan") {
            plan = JSON.parse(data) as PlanItem[];
            setState({ kind: "streaming", answer, sources, plan });
          } else if (event === "sources") {
            sources = JSON.parse(data) as Source[];
            setState({ kind: "streaming", answer, sources, plan });
          } else if (event === "token") {
            answer += JSON.parse(data) as string;
            setState({ kind: "streaming", answer, sources, plan });
          } else if (event === "error") {
            throw new Error(JSON.parse(data) as string);
          }
        }
      }

      setState({ kind: "done", answer, sources, plan });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const busy = state.kind === "streaming";
  const showResult = state.kind === "streaming" || state.kind === "done";
  const answer = showResult ? state.answer : "";
  const sources = showResult ? state.sources : [];
  const plan = showResult ? state.plan : [];

  const sourceBadge = (source: string) => {
    const styles: Record<string, string> = {
      docs: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      web: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      both: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    };
    return (
      <span
        className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${styles[source] ?? styles.docs}`}
      >
        {source}
      </span>
    );
  };

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
          Ask your documents
        </h2>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={agentic}
            onChange={(e) => setAgentic(e.target.checked)}
            className="h-3.5 w-3.5 accent-emerald-600"
          />
          Agentic mode {webReady ? "(docs + web)" : "(decompose)"}
        </label>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Claude answers using only the retrieved sources
        {webReady ? " (your documents + the live web)" : " from your uploads"},
        and cites them.
      </p>

      {ready === false && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          Answers need <code>VOYAGE_API_KEY</code>, <code>PINECONE_API_KEY</code>,
          and <code>ANTHROPIC_API_KEY</code> in <code>backend/.env</code> (then
          restart the backend).
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="e.g. how does the candidate's stack compare to what's in demand now?"
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-blue-500 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          onClick={handleAsk}
          disabled={!question.trim() || busy || ready === false}
          className="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Streaming…" : "Ask"}
        </button>
      </div>

      {state.kind === "error" && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {state.message}
        </div>
      )}

      {showResult && (
        <div className="mt-4 space-y-4">
          {plan.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Plan — sub-questions &amp; source routing
              </h3>
              <ol className="list-decimal space-y-0.5 pl-5 text-sm text-emerald-900 dark:text-emerald-200">
                {plan.map((p, i) => (
                  <li key={i}>
                    {p.question}
                    {sourceBadge(p.source)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-zinc-900">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-800 dark:text-zinc-200">
              {answer}
              {busy && <span className="ml-0.5 animate-pulse">▍</span>}
            </p>
          </div>

          {sources.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Sources
              </h3>
              <ol className="space-y-2">
                {sources.map((s) => (
                  <li
                    key={s.number}
                    className="rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <span className="font-medium">
                        [{s.number}]{" "}
                        {s.kind === "web" ? (
                          <a
                            href={s.url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 underline dark:text-purple-400"
                          >
                            🌐 {s.title || s.url}
                          </a>
                        ) : (
                          <>
                            📄 {s.doc_id ?? "?"} · chunk #{s.chunk_index ?? "?"}
                          </>
                        )}
                      </span>
                      <span className="shrink-0">score {s.score.toFixed(3)}</span>
                    </div>
                    <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-zinc-600 dark:text-zinc-400">
                      {s.text}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
