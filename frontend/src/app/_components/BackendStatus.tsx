"use client";

// Live dot + label showing whether the FastAPI backend is reachable.
// Fetches /health from the browser on mount.

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
    ok === null ? "Connecting…" : ok ? "Backend online" : "Backend offline";
  const color =
    ok === null ? "var(--ink3)" : ok ? "var(--sage)" : "var(--danger)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: color,
          animation: ok ? "pulse-dot 2.4s ease-in-out infinite" : "none",
        }}
      />
      <span style={{ fontSize: 10.5, color: "var(--ink3)" }}>{label}</span>
    </div>
  );
}
