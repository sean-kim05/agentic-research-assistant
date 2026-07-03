"use client";

// Phase 3-8 UI: a chat with your documents (+ web). Each question is answered
// with a grounded, cited answer streamed live. Agentic mode decomposes the
// question, routes each sub-question to docs/web, and synthesizes. Prior turns
// are kept and sent back as history so follow-ups have context.

import { useEffect, useRef, useState } from "react";
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

type Turn = {
  question: string;
  answer: string;
  plan: PlanItem[];
  sources: Source[];
};

type Live = {
  question: string;
  answer: string;
  plan: PlanItem[];
  sources: Source[];
};

function sourceBadge(source: string) {
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
}

function TurnView({
  turn,
  streaming = false,
}: {
  turn: Turn | Live;
  streaming?: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* the question */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-black">
          {turn.question}
        </div>
      </div>

      {/* plan */}
      {turn.plan.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Plan — sub-questions &amp; source routing
          </h3>
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-zinc-300">
            {turn.plan.map((p, i) => (
              <li key={i}>
                {p.question}
                {sourceBadge(p.source)}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* answer */}
      {(turn.answer || streaming) && (
        <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-zinc-900">
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-800 dark:text-zinc-200">
            {turn.answer}
            {streaming && <span className="ml-0.5 animate-pulse">▍</span>}
          </p>
        </div>
      )}

      {/* sources */}
      {turn.sources.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Sources
          </h3>
          <ol className="space-y-2">
            {turn.sources.map((s) => (
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
  );
}

export default function AskAssistant() {
  const [question, setQuestion] = useState("");
  const [agentic, setAgentic] = useState(true);
  const [ready, setReady] = useState<boolean | null>(null);
  const [webReady, setWebReady] = useState(false);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [live, setLive] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = live !== null;

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, live]);

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
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setError(null);

    let answer = "";
    let sources: Source[] = [];
    let plan: PlanItem[] = [];
    setLive({ question: q, answer, sources, plan });

    const endpoint = agentic ? "/ask/agentic" : "/ask/stream";
    const history = agentic
      ? turns.slice(-3).map((t) => ({ question: t.question, answer: t.answer }))
      : undefined;

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, top_k: agentic ? 4 : 5, history }),
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
            setLive({ question: q, answer, sources, plan });
          } else if (event === "sources") {
            sources = JSON.parse(data) as Source[];
            setLive({ question: q, answer, sources, plan });
          } else if (event === "token") {
            answer += JSON.parse(data) as string;
            setLive({ question: q, answer, sources, plan });
          } else if (event === "error") {
            throw new Error(JSON.parse(data) as string);
          }
        }
      }

      setTurns((prev) => [...prev, { question: q, answer, sources, plan }]);
      setLive(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLive(null);
    }
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
          Ask your documents
        </h2>
        <div className="flex items-center gap-3">
          {turns.length > 0 && (
            <button
              onClick={() => {
                setTurns([]);
                setError(null);
              }}
              className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Clear chat
            </button>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={agentic}
              onChange={(e) => setAgentic(e.target.checked)}
              className="h-3.5 w-3.5 accent-white"
            />
            Agentic mode {webReady ? "(docs + web)" : "(decompose)"}
          </label>
        </div>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Claude answers using only the retrieved sources
        {webReady ? " (your documents + the live web)" : " from your uploads"},
        cites them, and remembers the conversation.
      </p>

      {ready === false && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          Answers need <code>VOYAGE_API_KEY</code>, <code>PINECONE_API_KEY</code>,
          and <code>ANTHROPIC_API_KEY</code> in <code>backend/.env</code> (then
          restart the backend).
        </div>
      )}

      {/* conversation transcript */}
      {(turns.length > 0 || live) && (
        <div className="mt-4 space-y-6">
          {turns.map((t, i) => (
            <TurnView key={i} turn={t} />
          ))}
          {live && <TurnView turn={live} streaming />}
          <div ref={endRef} />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder={
            turns.length > 0
              ? "Ask a follow-up…"
              : "e.g. compare the candidate's backend and ML work"
          }
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          onClick={handleAsk}
          disabled={!question.trim() || busy || ready === false}
          className="shrink-0 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Streaming…" : "Ask"}
        </button>
      </div>
    </section>
  );
}
