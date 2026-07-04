"use client";

// Compact PDF uploader for the sidebar Library. Picks a PDF, POSTs it to the
// backend as multipart form-data, and on success dispatches "documents-changed"
// so the library list refreshes. (The verbose Phase-1 chunk preview was dropped
// in the redesign — chunking is verifiable via the backend /upload response.)

import { useState } from "react";
import { API_URL } from "@/lib/api";

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

export default function PdfUploader({ onDone }: { onDone?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleUpload() {
    if (!file) return;
    setStatus({ kind: "uploading" });
    try {
      const form = new FormData();
      form.append("file", file);
      // No manual Content-Type: the browser sets multipart boundary for FormData.
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: form });
      if (!res.ok) {
        let detail = `Upload failed (${res.status})`;
        try {
          const err = await res.json();
          if (err?.detail) detail = err.detail;
        } catch {
          // response wasn't JSON — keep the generic message
        }
        throw new Error(detail);
      }
      window.dispatchEvent(new Event("documents-changed"));
      setFile(null);
      setStatus({ kind: "idle" });
      onDone?.();
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <div
      style={{
        marginTop: 6,
        padding: 10,
        borderRadius: 9,
        border: "1px solid var(--line)",
        background: "var(--tint2)",
      }}
    >
      <label
        htmlFor="pdf-input"
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--ink2)",
          marginBottom: 7,
        }}
      >
        Add a PDF to the corpus
      </label>
      <input
        id="pdf-input"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setStatus({ kind: "idle" });
        }}
        style={{ width: "100%", fontSize: 11, color: "var(--ink2)" }}
        className="file:mr-2 file:rounded-md file:border-0 file:bg-[var(--btn-bg)] file:px-2.5 file:py-1 file:text-[11px] file:font-medium file:text-[var(--btn-fg)] file:cursor-pointer"
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
        <button
          onClick={handleUpload}
          disabled={!file || status.kind === "uploading"}
          style={{
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            cursor: file && status.kind !== "uploading" ? "pointer" : "not-allowed",
            background: "var(--btn-bg)",
            color: "var(--btn-fg)",
            opacity: !file || status.kind === "uploading" ? 0.5 : 1,
          }}
        >
          {status.kind === "uploading" ? "Indexing…" : "Upload & index"}
        </button>
        {file && (
          <span
            style={{
              fontSize: 10.5,
              color: "var(--ink3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {Math.round(file.size / 1024)} KB
          </span>
        )}
      </div>
      {status.kind === "error" && (
        <p style={{ marginTop: 8, fontSize: 11, color: "var(--danger)" }}>
          {status.message}
        </p>
      )}
    </div>
  );
}
