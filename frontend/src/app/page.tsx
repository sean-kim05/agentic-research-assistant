// Landing page (marketing front door). The app itself lives at /app.
// Server Component with two small client islands (ThemeToggle).

import Link from "next/link";
import Brand from "./_components/Brand";
import ThemeToggle from "./_components/ThemeToggle";
import { auth, authEnabled } from "@/auth";
import { signInWithGoogle } from "./actions/auth";

const GITHUB = "https://github.com/sean-kim05/agentic-research-assistant";
const STACK = ["Next.js", "FastAPI", "Claude", "Pinecone", "Voyage", "Tavily"];

const serif = "var(--font-newsreader), Georgia, serif";
const mono = "var(--font-geist-mono), monospace";

const ctaSolid: React.CSSProperties = {
  fontFamily: "inherit",
  fontWeight: 600,
  color: "var(--btn-fg)",
  background: "var(--btn-bg)",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
  borderRadius: 11,
};

export default async function Landing() {
  const session = authEnabled ? await auth() : null;
  const signedIn = Boolean(session);
  // When auth is enabled and the visitor isn't signed in, the CTA starts Google
  // sign-in; otherwise it just opens the app.
  const needsSignIn = authEnabled && !signedIn;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        color: "var(--ink)",
      }}
    >
      {/* top bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          maxWidth: 1040,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <Brand />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle />
          {needsSignIn ? (
            <form action={signInWithGoogle}>
              <button type="submit" style={{ ...ctaSolid, fontSize: 13, padding: "8px 14px", borderRadius: 9 }}>
                Continue with Google
              </button>
            </form>
          ) : (
            <Link href="/app" style={{ ...ctaSolid, fontSize: 13, padding: "8px 14px", borderRadius: 9 }}>
              Open Docent →
            </Link>
          )}
        </div>
      </header>

      {/* hero */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <div style={{ maxWidth: 660, textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontFamily: mono,
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--clay)",
              background: "var(--clay-soft)",
              border: "1px solid var(--clay-border)",
              padding: "5px 12px",
              borderRadius: 999,
              marginBottom: 26,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--clay)" }} />
            Agentic · multi-source · cited
          </div>

          <h1
            style={{
              fontFamily: serif,
              fontSize: 52,
              lineHeight: 1.08,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Answers you can trace back to the source.
          </h1>

          <p
            style={{
              maxWidth: 520,
              margin: "22px auto 0",
              fontSize: 16,
              lineHeight: 1.65,
              color: "var(--ink2)",
            }}
          >
            Docent decomposes each question into sub-questions, retrieves from
            your uploaded documents <em style={{ fontStyle: "normal", color: "var(--ink)" }}>and</em> the
            live web, then writes a structured answer with citations you can open.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
            {needsSignIn ? (
              <form action={signInWithGoogle}>
                <button type="submit" style={{ ...ctaSolid, fontSize: 14, padding: "12px 22px" }}>
                  Continue with Google
                </button>
              </form>
            ) : (
              <Link href="/app" style={{ ...ctaSolid, fontSize: 14, padding: "12px 22px" }}>
                Open Docent →
              </Link>
            )}
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--ink2)",
                background: "transparent",
                padding: "12px 22px",
                borderRadius: 11,
                border: "1px solid var(--line2)",
                textDecoration: "none",
              }}
            >
              View source
            </a>
          </div>

          <p style={{ marginTop: 16, fontSize: 12, color: "var(--ink3)" }}>
            {needsSignIn
              ? "Sign in with Google to open your workspace."
              : authEnabled
                ? "You're signed in."
                : "Open access — Google sign-in available once configured."}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 40 }}>
            {STACK.map((tech) => (
              <span
                key={tech}
                style={{
                  fontFamily: mono,
                  fontSize: 11,
                  color: "var(--ink3)",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  padding: "5px 11px",
                  borderRadius: 999,
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* footer */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "18px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 12,
            color: "var(--ink3)",
          }}
        >
          <span>Agentic RAG · plain-Python retrieval, no LangChain</span>
          <a
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--ink3)", textDecoration: "none" }}
          >
            sean-kim05/agentic-research-assistant
          </a>
        </div>
      </footer>
    </div>
  );
}
