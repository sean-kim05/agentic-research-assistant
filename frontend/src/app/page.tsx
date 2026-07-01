"use client";

// This is a CLIENT Component (note the "use client" directive above).
// It needs React state + useEffect + a browser fetch, which only run in the
// browser -- so it cannot be a Server Component. Because the fetch happens in
// the browser, CORS applies and the FastAPI backend must allow this origin.

import { useEffect, useState } from "react";

// Backend base URL. The NEXT_PUBLIC_ prefix is what exposes this value to the
// browser bundle; without it, the variable would be empty on the client.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type HealthResponse = {
  status: string;
  service: string;
  message: string;
};

type State =
  | { kind: "loading" }
  | { kind: "error"; error: string }
  | { kind: "ok"; data: HealthResponse };

export default function Home() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function checkBackend() {
      try {
        const res = await fetch(`${API_URL}/health`);
        if (!res.ok) throw new Error(`Backend responded with ${res.status}`);
        const data = (await res.json()) as HealthResponse;
        if (!cancelled) setState({ kind: "ok", data });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    checkBackend();
    return () => {
      cancelled = true; // avoid setting state after unmount
    };
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 p-8 dark:bg-black">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Agentic Research Assistant
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Phase 0 &mdash; frontend &harr; backend connection check
        </p>
      </div>

      <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-zinc-900">
        {state.kind === "loading" && (
          <p className="text-zinc-500">Contacting backend&hellip;</p>
        )}

        {state.kind === "error" && (
          <div className="space-y-2">
            <p className="font-medium text-red-600">
              &#10060; Could not reach backend
            </p>
            <p className="text-sm text-zinc-500">{state.error}</p>
            <p className="text-xs text-zinc-400">
              Is the FastAPI server running on {API_URL}?
            </p>
          </div>
        )}

        {state.kind === "ok" && (
          <div className="space-y-2">
            <p className="font-medium text-green-600">
              &#9989; Connected &mdash; status: {state.data.status}
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {state.data.message}
            </p>
            <p className="text-xs text-zinc-400">
              service: {state.data.service}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
