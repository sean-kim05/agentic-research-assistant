"use client";

// The main chat pane: header (thread title + agentic/theme toggles), the
// transcript (user turn → plan → cited answer → sources), and the input bar.
// Agentic mode decomposes the question, routes each sub-question to docs/web,
// and streams a synthesized, cited answer. Prior turns are sent back as history
// so follow-ups have context. Logic is unchanged from the previous version —
// this is a visual redesign onto the Docent design system.

import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import ThemeToggle from "./ThemeToggle";
import { DocentMark } from "./Brand";

type PlanItem = { question: string; source: string };

type Source = {
  number: number;
  kind: "doc" | "web";
  score: number;
  text: string;
  doc_id?: string | null;
  chunk_index?: number | null;
  title?: string | null;
  url?: string | null;
};

type Turn = {
  question: string;
  answer: string;
  plan: PlanItem[];
  sources: Source[];
};

const mono = "var(--font-geist-mono), monospace";
const serif = "var(--font-newsreader), Georgia, serif";

const PLAN_DOT: Record<string, string> = {
  docs: "var(--clay)",
  web: "var(--sage)",
  both: "var(--amber)",
};

// Claude replies in Markdown. We render the common cases the model actually uses
// — **bold**, ## headings, and -/1. lists — plus turn "[n]" citation markers into
// clay superscripts. (A full Markdown lib is overkill for this limited output.)

// Inline: [n] citations -> superscripts.
function renderCitations(text: string, keyBase: string): React.ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = /^\[(\d+)\]$/.exec(part);
    if (m) {
      return (
        <sup
          key={`${keyBase}-c${i}`}
          style={{ color: "var(--clay)", fontFamily: mono, fontSize: 10, fontWeight: 500, padding: "0 1px" }}
        >
          [{m[1]}]
        </sup>
      );
    }
    return <span key={`${keyBase}-c${i}`}>{part}</span>;
  });
}

// Inline: **bold** (with citations inside), interleaved with plain text.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((seg, i) => {
    if (!seg) return;
    const b = /^\*\*([^*]+)\*\*$/.exec(seg);
    if (b) {
      out.push(
        <strong key={`${keyBase}-b${i}`} style={{ fontWeight: 600, color: "var(--ink)" }}>
          {renderCitations(b[1], `${keyBase}-b${i}`)}
        </strong>,
      );
    } else {
      out.push(...renderCitations(seg, `${keyBase}-t${i}`));
    }
  });
  return out;
}

// Block-level: headings, bullets, numbered items, dividers, paragraphs.
function renderAnswer(text: string, streaming = false) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    const rule = /^\s*---+\s*$/.test(line);
    const caret =
      streaming && i === lines.length - 1 ? (
        <span key="caret" style={{ marginLeft: 2, color: "var(--clay)", animation: "blink 1s step-start infinite" }}>
          ▍
        </span>
      ) : null;

    if (heading) {
      return (
        <div key={i} style={{ fontWeight: 600, fontSize: 16.5, color: "var(--ink)", margin: "18px 0 6px", lineHeight: 1.4 }}>
          {renderInline(heading[1], `h${i}`)}
          {caret}
        </div>
      );
    }
    if (rule) {
      return <div key={i} style={{ borderTop: "1px solid var(--line)", margin: "14px 0" }} />;
    }
    if (bullet) {
      return (
        <div key={i} style={{ display: "flex", gap: 10, margin: "4px 0" }}>
          <span style={{ color: "var(--ink3)", flexShrink: 0 }}>•</span>
          <span>
            {renderInline(bullet[1], `l${i}`)}
            {caret}
          </span>
        </div>
      );
    }
    if (numbered) {
      return (
        <div key={i} style={{ display: "flex", gap: 10, margin: "4px 0" }}>
          <span style={{ color: "var(--ink3)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{numbered[1]}.</span>
          <span>
            {renderInline(numbered[2], `l${i}`)}
            {caret}
          </span>
        </div>
      );
    }
    if (line.trim() === "") {
      return <div key={i} style={{ height: "0.5em" }}>{caret}</div>;
    }
    return (
      <div key={i} style={{ margin: "2px 0" }}>
        {renderInline(line, `p${i}`)}
        {caret}
      </div>
    );
  });
}

function PlanBox({ plan }: { plan: PlanItem[] }) {
  return (
    <div
      style={{
        marginBottom: 24,
        border: "1px solid var(--line)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--tint2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "12px 15px 10px" }}>
        <span
          style={{
            fontFamily: mono,
            fontSize: 10,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--clay)",
          }}
        >
          Plan
        </span>
        <span style={{ fontSize: 11.5, color: "var(--ink3)" }}>
          broken into {plan.length} {plan.length === 1 ? "line" : "lines"} of inquiry
        </span>
      </div>
      <div style={{ padding: "0 15px 4px" }}>
        {plan.map((p, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 13,
              padding: "9px 0",
              borderTop: "1px solid var(--line)",
            }}
          >
            <span style={{ flexShrink: 0, fontFamily: serif, fontSize: 15, color: "var(--clay)", width: 14 }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.5 }}>
              {p.question}
            </span>
            <span
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                fontFamily: mono,
                fontSize: 9,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "3px 8px",
                borderRadius: 999,
                color: "var(--ink2)",
                border: "1px solid var(--line2)",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: PLAN_DOT[p.source] ?? "var(--clay)" }} />
              {p.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourcesList({ sources }: { sources: Source[] }) {
  return (
    <div style={{ marginTop: 26, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
      <div
        style={{
          fontFamily: mono,
          fontSize: 10,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--ink3)",
          marginBottom: 4,
        }}
      >
        Sources · {sources.length}
      </div>
      {sources.map((s) => {
        const web = s.kind === "web";
        const title = web ? s.title || s.url || "web result" : s.doc_id ?? "document";
        const sub = web
          ? s.url ?? ""
          : `chunk #${s.chunk_index ?? "?"} · ${s.text.slice(0, 90)}${s.text.length > 90 ? "…" : ""}`;
        const inner = (
          <>
            <span style={{ flexShrink: 0, fontFamily: serif, fontSize: 15, color: "var(--clay)", width: 16 }}>
              {s.number}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {web ? "🌐 " : ""}
                  {title}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: mono,
                    fontSize: 8.5,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--ink3)",
                    border: "1px solid var(--line2)",
                    padding: "1px 6px",
                    borderRadius: 999,
                  }}
                >
                  {web ? "web" : "document"}
                </span>
              </div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 10.5,
                  color: "var(--ink3)",
                  marginTop: 3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {sub}
              </div>
            </div>
            <span style={{ flexShrink: 0, fontFamily: mono, fontSize: 10.5, color: "var(--ink2)", fontVariantNumeric: "tabular-nums" }}>
              {s.score.toFixed(2)}
            </span>
          </>
        );
        const rowStyle: React.CSSProperties = {
          display: "flex",
          alignItems: "baseline",
          gap: 13,
          padding: "11px 2px",
          borderBottom: "1px solid var(--line)",
          textDecoration: "none",
        };
        return web ? (
          <a key={s.number} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" style={rowStyle}>
            {inner}
          </a>
        ) : (
          <div key={s.number} style={rowStyle}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function TurnView({ turn, streaming = false }: { turn: Turn; streaming?: boolean }) {
  return (
    <div style={{ marginBottom: 32 }}>
      {/* user turn */}
      <div style={{ display: "flex", gap: 14, marginBottom: 22 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "var(--tint)",
            border: "1px solid var(--line2)",
            color: "var(--ink2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0116 0" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink3)", marginBottom: 5 }}>You</div>
          <div style={{ fontSize: 16, color: "var(--ink)", lineHeight: 1.55 }}>{turn.question}</div>
        </div>
      </div>

      {/* assistant turn */}
      <div style={{ display: "flex", gap: 14 }}>
        <span style={{ flexShrink: 0, marginTop: 1, color: "var(--ink)" }}>
          <DocentMark size={28} lines={false} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink3)", marginBottom: 12 }}>Docent</div>

          {turn.plan.length > 0 && <PlanBox plan={turn.plan} />}

          {(turn.answer || streaming) && (
            <div
              style={{
                fontFamily: serif,
                fontSize: 18,
                color: "var(--prose)",
                lineHeight: 1.72,
                wordBreak: "break-word",
              }}
            >
              {renderAnswer(turn.answer, streaming)}
            </div>
          )}

          {turn.sources.length > 0 && <SourcesList sources={turn.sources} />}
        </div>
      </div>
    </div>
  );
}

function AgenticToggle({
  agentic,
  webReady,
  onToggle,
}: {
  agentic: boolean;
  webReady: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={webReady ? "Agentic: decompose + docs & web" : "Agentic: decompose the question"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 32,
        padding: "0 11px",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 500,
        background: agentic ? "var(--clay-soft)" : "transparent",
        border: `1px solid ${agentic ? "var(--clay-border)" : "var(--line2)"}`,
        color: agentic ? "var(--clay)" : "var(--ink3)",
      }}
    >
      <span style={{ width: 26, height: 15, borderRadius: 999, background: agentic ? "var(--clay)" : "var(--line2)", position: "relative", flexShrink: 0, transition: "background .18s" }}>
        <span style={{ position: "absolute", top: 2, left: agentic ? 13 : 2, width: 11, height: 11, borderRadius: "50%", background: "var(--knob)", transition: "left .18s" }} />
      </span>
      Agentic mode
    </button>
  );
}

export default function AskAssistant() {
  const [question, setQuestion] = useState("");
  const [agentic, setAgentic] = useState(true);
  const [ready, setReady] = useState<boolean | null>(null);
  const [webReady, setWebReady] = useState(false);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [live, setLive] = useState<Turn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = live !== null;

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, live]);

  // "New thread" from the sidebar clears the conversation and refocuses input.
  useEffect(() => {
    const reset = () => {
      setTurns([]);
      setLive(null);
      setError(null);
      setQuestion("");
      inputRef.current?.focus();
    };
    window.addEventListener("new-thread", reset);
    return () => window.removeEventListener("new-thread", reset);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/status`)
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) {
          setReady(Boolean(s.voyage_ready && s.pinecone_ready && s.anthropic_ready));
          setWebReady(Boolean(s.web_search_ready));
        }
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAsk(explicit?: string) {
    const q = (explicit ?? question).trim();
    if (!q || busy) return;
    setQuestion("");
    setError(null);

    let answer = "";
    let sources: Source[] = [];
    let plan: PlanItem[] = [];
    setLive({ question: q, answer, sources, plan });

    const endpoint = agentic ? "/ask/agentic" : "/ask/stream";
    const history = agentic
      ? turns.slice(-3).map((t) => ({ question: t.question, answer: t.answer }))
      : undefined;

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, top_k: agentic ? 4 : 5, history }),
      });
      if (!res.ok || !res.body) {
        let detail = `Ask failed (${res.status})`;
        try {
          const e = await res.json();
          if (e?.detail) detail = e.detail;
        } catch {
          // not JSON
        }
        throw new Error(detail);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const records = buffer.split("\n\n");
        buffer = records.pop() ?? "";

        for (const record of records) {
          if (!record.trim()) continue;
          let event = "message";
          let data = "";
          for (const line of record.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (event === "plan") {
            plan = JSON.parse(data) as PlanItem[];
            setLive({ question: q, answer, sources, plan });
          } else if (event === "sources") {
            sources = JSON.parse(data) as Source[];
            setLive({ question: q, answer, sources, plan });
          } else if (event === "token") {
            answer += JSON.parse(data) as string;
            setLive({ question: q, answer, sources, plan });
          } else if (event === "error") {
            throw new Error(JSON.parse(data) as string);
          }
        }
      }

      setTurns((prev) => [...prev, { question: q, answer, sources, plan }]);
      setLive(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLive(null);
    }
  }

  const threadTitle = turns[0]?.question ?? live?.question ?? "New thread";
  const latest = live ?? turns[turns.length - 1];
  const sourceCount = latest?.sources.length ?? 0;
  const hasContent = turns.length > 0 || live !== null;

  const EXAMPLES = [
    "Summarize the key points across my documents",
    "What are the main risks mentioned?",
    "How does this compare to what's current in 2026?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      {/* header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: 56,
          borderBottom: "1px solid var(--line)",
          flexShrink: 0,
          background: "var(--topbar)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <span
            style={{
              fontFamily: serif,
              fontSize: 16,
              fontWeight: 500,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {threadTitle}
          </span>
          {sourceCount > 0 && (
            <span style={{ fontFamily: mono, fontSize: 10.5, color: "var(--ink3)", flexShrink: 0 }}>
              {sourceCount} sources
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {turns.length > 0 && (
            <button
              onClick={() => {
                setTurns([]);
                setLive(null);
                setError(null);
              }}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "var(--ink3)" }}
            >
              Clear
            </button>
          )}
          <AgenticToggle agentic={agentic} webReady={webReady} onToggle={() => setAgentic((v) => !v)} />
          <ThemeToggle />
        </div>
      </header>

      {/* transcript */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "32px 28px 40px" }}>
          {ready === false && (
            <div
              style={{
                marginBottom: 24,
                padding: 14,
                borderRadius: 10,
                border: "1px solid var(--amber)",
                background: "var(--clay-soft)",
                fontSize: 13,
                color: "var(--ink2)",
              }}
            >
              Answers need <code style={{ fontFamily: mono }}>VOYAGE_API_KEY</code>,{" "}
              <code style={{ fontFamily: mono }}>PINECONE_API_KEY</code>, and{" "}
              <code style={{ fontFamily: mono }}>ANTHROPIC_API_KEY</code> in{" "}
              <code style={{ fontFamily: mono }}>backend/.env</code> (then restart the backend).
            </div>
          )}

          {!hasContent ? (
            <div style={{ paddingTop: 64, textAlign: "center" }}>
              <h1 style={{ fontFamily: serif, fontSize: 30, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em", margin: 0 }}>
                Ask across your documents and the web
              </h1>
              <p style={{ maxWidth: 440, margin: "14px auto 0", fontSize: 14, color: "var(--ink2)", lineHeight: 1.6 }}>
                Every question is decomposed into sub-questions, retrieved from the right source
                {webReady ? " — your documents and the live web" : ""}, and answered with citations you can open.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 24 }}>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => handleAsk(ex)}
                    style={{
                      fontFamily: "inherit",
                      fontSize: 12.5,
                      color: "var(--ink2)",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 999,
                      padding: "7px 13px",
                      cursor: "pointer",
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {turns.map((t, i) => (
                <TurnView key={i} turn={t} />
              ))}
              {live && <TurnView turn={live} streaming />}
            </>
          )}

          {error && (
            <div
              style={{
                marginTop: 20,
                padding: 14,
                borderRadius: 10,
                border: "1px solid var(--danger-border)",
                background: "var(--danger-soft)",
                fontSize: 13,
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* input */}
      <div style={{ flexShrink: 0, padding: "8px 28px 20px", background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--bg) 22%)" }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line2)",
              borderRadius: 15,
              padding: "12px 14px 10px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder={
                turns.length > 0
                  ? "Ask a follow-up across your documents and the web…"
                  : "Ask a question across your documents and the web…"
              }
              style={{
                width: "100%",
                background: "none",
                border: "none",
                outline: "none",
                color: "var(--ink)",
                fontFamily: "inherit",
                fontSize: 14.5,
                padding: "2px 2px 8px",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: agentic ? "var(--clay)" : "var(--ink3)", padding: "0 6px" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: agentic ? "var(--clay)" : "var(--ink3)" }} />
                {agentic ? (webReady ? "Agentic · docs + web" : "Agentic · decompose") : "Direct"}
              </span>
              <button
                onClick={() => handleAsk()}
                disabled={!question.trim() || busy || ready === false}
                title="Send"
                aria-label="Send"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  border: "none",
                  cursor: !question.trim() || busy || ready === false ? "not-allowed" : "pointer",
                  background: "var(--btn-bg)",
                  color: "var(--btn-fg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !question.trim() || busy || ready === false ? 0.5 : 1,
                }}
              >
                {busy ? (
                  <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 10.5, color: "var(--ink3)", marginTop: 8 }}>
            Docent can be wrong — every claim links back to a source you can open.
          </div>
        </div>
      </div>
    </div>
  );
}
