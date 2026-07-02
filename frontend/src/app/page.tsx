// This is a SERVER Component (no "use client"). It renders static layout and
// drops in two interactive Client Components (islands): the live backend
// status badge and the PDF uploader.

import BackendStatus from "./_components/BackendStatus";
import PdfUploader from "./_components/PdfUploader";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Agentic Research Assistant
          </h1>
          <BackendStatus />
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Phase 1 &mdash; upload a PDF, extract its text, and split it into
          overlapping chunks.
        </p>
      </header>

      <PdfUploader />
    </main>
  );
}
