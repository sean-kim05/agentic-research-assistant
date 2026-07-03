"use client";

// The interactive heart of Phase 1: pick a PDF, POST it to the backend as
// multipart form-data, and render the chunks that come back.

import { useState } from "react";
import { API_URL } from "@/lib/api";

type Chunk = { id: number; text: string; char_count: number };

type UploadResponse = {
  filename: string;
  num_pages: number;
  num_chars: number;
  chunk_size: number;
  overlap: number;
  num_chunks: number;
  chunks: Chunk[];
};

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string }
  | { kind: "done"; data: UploadResponse };

export default function PdfUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleUpload() {
    if (!file) return;
    setStatus({ kind: "uploading" });

    try {
      const form = new FormData();
      form.append("file", file);

      // Do NOT set Content-Type manually: when the body is a FormData, the
      // browser sets "multipart/form-data" WITH the correct boundary for us.
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        // FastAPI returns errors as { detail: "..." }.
        let detail = `Upload failed (${res.status})`;
        try {
          const err = await res.json();
          if (err?.detail) detail = err.detail;
        } catch {
          // response wasn't JSON; keep the generic message
        }
        throw new Error(detail);
      }

      const data = (await res.json()) as UploadResponse;
      setStatus({ kind: "done", data });
      // Tell the DocumentLibrary to refresh.
      window.dispatchEvent(new Event("documents-changed"));
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload controls */}
      <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Choose a PDF
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setStatus({ kind: "idle" });
            }}
            className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 dark:text-zinc-300 dark:file:bg-zinc-100 dark:file:text-black"
          />
          <button
            onClick={handleUpload}
            disabled={!file || status.kind === "uploading"}
            className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status.kind === "uploading" ? "Processing…" : "Upload & chunk"}
          </button>
        </div>
        {file && (
          <p className="mt-2 text-xs text-zinc-500">
            Selected: {file.name} ({Math.round(file.size / 1024)} KB)
          </p>
        )}
      </div>

      {/* Error state */}
      {status.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {status.message}
        </div>
      )}

      {/* Results */}
      {status.kind === "done" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Pages" value={status.data.num_pages} />
            <Stat
              label="Characters"
              value={status.data.num_chars.toLocaleString()}
            />
            <Stat label="Chunks" value={status.data.num_chunks} />
            <Stat
              label="Size / overlap"
              value={`${status.data.chunk_size} / ${status.data.overlap}`}
            />
          </div>

          <div className="space-y-3">
            {status.data.chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900"
              >
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-medium">Chunk #{chunk.id}</span>
                  <span>{chunk.char_count} chars</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-300">
                  {chunk.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 text-center dark:border-white/15 dark:bg-zinc-900">
      <div className="text-lg font-semibold text-black dark:text-zinc-50">
        {value}
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
