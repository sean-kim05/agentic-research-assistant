"use client";

import Link from "next/link";
import Brand from "./Brand";
import DocumentLibrary from "./DocumentLibrary";
import BackendStatus from "./BackendStatus";
import ThemeToggle from "./ThemeToggle";
import { signOutAction } from "../actions/auth";
import type { View, SessionUser } from "./Workspace";

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
  user = null,
}: {
  view: View;
  onView: (v: View) => void;
  onNewThread: () => void;
  user?: SessionUser;
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

      {/* Footer: signed-in user (when auth is on) + backend status + theme. */}
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 12 }}>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10, padding: "0 2px" }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--clay)",
                color: "var(--on-clay)",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                textTransform: "uppercase",
              }}
            >
              {(user.name || user.email || "?").trim().charAt(0)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.name || user.email}
              </div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink3)",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            </form>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9 }}>
          <BackendStatus />
          <ThemeToggle size={28} />
        </div>
      </div>
    </aside>
  );
}
