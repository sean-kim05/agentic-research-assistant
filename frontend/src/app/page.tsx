// Server Component: the app shell (nav + hero + footer) around the interactive
// client "islands". Developer-dark theme (forced in layout.tsx).

import AskAssistant from "./_components/AskAssistant";
import BackendStatus from "./_components/BackendStatus";
import DocumentLibrary from "./_components/DocumentLibrary";
import PdfUploader from "./_components/PdfUploader";
import SemanticSearch from "./_components/SemanticSearch";

const GITHUB = "https://github.com/sean-kim05/agentic-research-assistant";
const STACK = ["Next.js", "FastAPI", "Claude", "Pinecone", "Voyage", "Tavily"];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky glass nav */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              ◆
            </span>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              research<span className="text-emerald-400">.ai</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              GitHub ↗
            </a>
            <BackendStatus />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 sm:px-6">
        {/* Hero */}
        <section className="py-14 text-center sm:py-20">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Agentic · multi-source · cited
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            Agentic Research Assistant
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-zinc-400 sm:text-base">
            Upload documents, then ask questions answered across your files and
            the live web. Each question is decomposed into sub-questions,
            retrieved from the right source, and answered with citations.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {STACK.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-400"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* Feature panels (each component renders its own titled section) */}
        <div className="space-y-2 pb-16">
          <PdfUploader />
          <DocumentLibrary />
          <AskAssistant />
          <SemanticSearch />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-zinc-500 sm:px-6">
          <span>Agentic RAG · plain-Python retrieval, no LangChain</span>
          <a
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-zinc-300"
          >
            sean-kim05/agentic-research-assistant
          </a>
        </div>
      </footer>
    </div>
  );
}
