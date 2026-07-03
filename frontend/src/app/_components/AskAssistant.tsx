"use client";

// Phase 3 UI: ask a question, get an answer Claude generated grounded in the
// retrieved document chunks. Checks /status so it can tell you when a key is
// missing (needs Voyage + Pinecone + Anthropic).

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type AskResponse = { question: string; answer: string };

type State =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "error"; message: string }
  | { kind: "done"; data: AskResponse };

export default function AskAssistant() {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/status`)
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) {
          setReady(
            Boolean(s.voyage_ready && s.pinecone_ready && s.anthropic_ready),
          );
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
    setState({ kind: "asking" });
    try {
      const res = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, top_k: 5 }),
      });
      if (!res.ok) {
        let detail = `Ask failed (${res.status})`;
        try {
          const e = await res.json();
          if (e?.detail) detail = e.detail;
        } catch {
          // not JSON
        }
        throw new Error(detail);
      }
      const data = (await res.json()) as AskResponse;
      setState({ kind: "done", data });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
        Ask your documents
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Claude answers using only the passages retrieved from your uploads.
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
          placeholder="e.g. what backend experience does the candidate have?"
          className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-blue-500 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          onClick={handleAsk}
          disabled={!question.trim() || state.kind === "asking" || ready === false}
          className="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.kind === "asking" ? "Thinking…" : "Ask"}
        </button>
      </div>

      {state.kind === "error" && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {state.message}
        </div>
      )}

      {state.kind === "done" && (
        <div className="mt-4 rounded-xl border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-zinc-900">
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-800 dark:text-zinc-200">
            {state.data.answer}
          </p>
        </div>
      )}
    </section>
  );
}
