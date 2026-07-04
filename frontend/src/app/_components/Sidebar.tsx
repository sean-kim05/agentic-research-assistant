"use client";

import Link from "next/link";
import Brand from "./Brand";
import DocumentLibrary from "./DocumentLibrary";
import BackendStatus from "./BackendStatus";
import ThemeToggle from "./ThemeToggle";
import type { View } from "./Workspace";

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  {
    id: "chat",
    label: "Ask",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.4 8.4 0 01-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1121 11.5z" />
      </svg>
    ),
  },
  {
    id: "search",
    label: "Search chunks",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    ),
  },
];

export default function Sidebar({
  view,
  onView,
  onNewThread,
}: {
  view: View;
  onView: (v: View) => void;
  onNewThread: () => void;
}) {
  return (
    <aside
      className="hidden md:flex"
      style={{
        width: 266,
        flexShrink: 0,
        background: "var(--sidebar)",
        borderRight: "1px solid var(--line)",
        flexDirection: "column",
        padding: "14px 12px 12px",
      }}
    >
      {/* Clicking the logo returns to the landing page. */}
      <Link
        href="/"
        title="Back to home"
        style={{ display: "block", padding: "6px 8px 14px", textDecoration: "none" }}
      >
        <Brand />
      </Link>

      <button
        onClick={onNewThread}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          width: "100%",
          padding: "9px 12px",
          marginBottom: 16,
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--btn-fg)",
          background: "var(--btn-bg)",
          border: "none",
          borderRadius: 9,
          cursor: "pointer",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New thread
      </button>

      <div
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--ink3)",
          padding: "0 8px 8px",
        }}
      >
        Workspace
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onView(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 10px",
                fontFamily: "inherit",
                fontSize: 13,
                textAlign: "left",
                cursor: "pointer",
                borderRadius: 8,
                border: "none",
                color: active ? "var(--ink)" : "var(--ink2)",
                background: active ? "var(--tint)" : "transparent",
                borderLeft: `2px solid ${active ? "var(--clay)" : "transparent"}`,
              }}
            >
              <span style={{ color: active ? "var(--clay)" : "var(--ink3)", display: "flex" }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
        <DocumentLibrary />
      </div>

      {/* Footer: backend status + theme. A real user menu (avatar, name,
          sign out) replaces this once Google auth is wired up. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 9,
          borderTop: "1px solid var(--line)",
          marginTop: 10,
          paddingTop: 12,
        }}
      >
        <BackendStatus />
        <ThemeToggle size={28} />
      </div>
    </aside>
  );
}
