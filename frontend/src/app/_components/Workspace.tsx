"use client";

// The two-pane app shell: sidebar + main. Owns which main view is active and
// broadcasts "new-thread" so the chat can reset. Kept thin — each pane manages
// its own data + streaming.

import { useState } from "react";
import Sidebar from "./Sidebar";
import AskAssistant from "./AskAssistant";
import SemanticSearch from "./SemanticSearch";

export type View = "chat" | "search";

export default function Workspace() {
  const [view, setView] = useState<View>("chat");

  const newThread = () => {
    setView("chat");
    window.dispatchEvent(new Event("new-thread"));
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      <Sidebar view={view} onView={setView} onNewThread={newThread} />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Both panes stay mounted so chat state/streaming survive a view switch. */}
        <div style={{ display: view === "chat" ? "flex" : "none", flex: 1, minHeight: 0, flexDirection: "column" }}>
          <AskAssistant />
        </div>
        <div style={{ display: view === "search" ? "flex" : "none", flex: 1, minHeight: 0, flexDirection: "column" }}>
          <SemanticSearch />
        </div>
      </main>
    </div>
  );
}
