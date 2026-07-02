"use client";

// Small live badge showing whether the FastAPI backend is reachable.
// Client Component because it fetches from the browser on mount.

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export default function BackendStatus() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/health`)
      .then((r) => r.ok)
      .catch(() => false)
      .then((good) => {
        if (!cancelled) setOk(good);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    ok === null ? "checking…" : ok ? "backend online" : "backend offline";
  const dot = ok === null ? "bg-zinc-400" : ok ? "bg-green-500" : "bg-red-500";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1 text-xs text-zinc-600 dark:border-white/15 dark:text-zinc-300">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
