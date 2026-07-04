"use client";

// Sidebar Library: the documents uploaded this session. Add via the "+" (opens
// the compact uploader), delete a doc (which also removes its vectors from
// Pinecone). Auto-refreshes on the "documents-changed" event the uploader fires.

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import PdfUploader from "./PdfUploader";

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
  const [adding, setAdding] = useState(false);

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

  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px 8px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--ink3)",
          }}
        >
          Library · {docs.length}
        </span>
        <button
          onClick={() => setAdding((v) => !v)}
          title="Add document"
          aria-label="Add document"
          style={{
            background: "none",
            border: "none",
            color: "var(--ink3)",
            cursor: "pointer",
            padding: 0,
            display: "flex",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ transform: adding ? "rotate(45deg)" : "none", transition: "transform .15s" }}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {adding && <PdfUploader onDone={() => setAdding(false)} />}

      {docs.length === 0 && !adding && (
        <p style={{ padding: "2px 8px 6px", fontSize: 11.5, color: "var(--ink3)" }}>
          No documents yet — add a PDF to ground answers.
        </p>
      )}

      <div style={{ marginTop: docs.length ? 2 : 0 }}>
        {docs.map((d) => (
          <div
            key={d.doc_id}
            className="group"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "6px 8px",
              borderRadius: 7,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: 7,
                fontWeight: 600,
                color: d.indexed ? "var(--clay)" : "var(--amber)",
                border: `1px solid ${d.indexed ? "var(--clay-border)" : "var(--amber)"}`,
                borderRadius: 4,
                padding: "2px 3px",
                flexShrink: 0,
              }}
            >
              PDF
            </span>
            <span
              title={`${d.filename} · ${d.num_pages} pages · ${d.num_chunks} chunks`}
              style={{
                flex: 1,
                fontSize: 12,
                color: "var(--ink2)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {d.filename}
            </span>
            <button
              onClick={() => remove(d.doc_id)}
              disabled={deleting === d.doc_id}
              title="Delete document"
              aria-label="Delete document"
              className="opacity-0 group-hover:opacity-100"
              style={{
                background: "none",
                border: "none",
                color: "var(--ink3)",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                flexShrink: 0,
                transition: "opacity .12s, color .12s",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 002 2h6a2 2 0 002-2V6" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
