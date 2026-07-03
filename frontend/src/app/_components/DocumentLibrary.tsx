"use client";

// Phase 8: lists the documents uploaded this session and lets you delete one
// (which also removes its vectors from Pinecone). Auto-refreshes when the
// uploader dispatches a "documents-changed" event.

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Doc = {
  doc_id: string;
  filename: string;
  num_pages: number;
  num_chars: number;
  num_chunks: number;
  indexed: boolean;
};

export default function DocumentLibrary() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`${API_URL}/documents`)
      .then((r) => r.json())
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => setDocs([]));
  }, []);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("documents-changed", onChange);
    return () => window.removeEventListener("documents-changed", onChange);
  }, [load]);

  async function remove(docId: string) {
    setDeleting(docId);
    try {
      await fetch(`${API_URL}/documents/${encodeURIComponent(docId)}`, {
        method: "DELETE",
      });
      load();
    } finally {
      setDeleting(null);
    }
  }

  if (docs.length === 0) return null; // nothing uploaded yet — stay hidden

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
        Document library
      </h2>
      <ul className="mt-3 space-y-2">
        {docs.map((d) => (
          <li
            key={d.doc_id}
            className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                📄 {d.filename}
              </p>
              <p className="text-xs text-zinc-500">
                {d.num_pages} pages · {d.num_chunks} chunks ·{" "}
                {d.indexed ? (
                  <span className="text-green-600 dark:text-green-400">
                    indexed
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    not indexed
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => remove(d.doc_id)}
              disabled={deleting === d.doc_id}
              className="shrink-0 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              {deleting === d.doc_id ? "Deleting…" : "Delete"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
