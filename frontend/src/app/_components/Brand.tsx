// The Docent mark + wordmark. The mark is a rounded "D" drawn as one outline
// (stem = the closing left edge) with two text lines and a folded clay corner —
// a document that reads as a D. Server-safe (no hooks). currentColor = --ink.

export function DocentMark({ size = 28, lines = true }: { size?: number; lines?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      {/* D outline: top edge → bowl arc → bottom edge → stem (Z) */}
      <path
        d="M12 7 H18 A13 13 0 0 1 18 33 H12 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* text lines inside the counter */}
      {lines && (
        <>
          <rect x="15.6" y="18" width="8.4" height="2.4" rx="1.2" fill="currentColor" />
          <rect x="15.6" y="22.6" width="8.4" height="2.4" rx="1.2" fill="currentColor" />
        </>
      )}
      {/* folded page corner */}
      <path d="M15.6 10.4 H21.4 L15.6 16.2 Z" fill="var(--clay)" />
    </svg>
  );
}

export default function Brand({ size = 28 }: { size?: number }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)" }}>
      <DocentMark size={size} />
      <span
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontWeight: 600,
          fontSize: Math.round(size * 0.82),
          letterSpacing: "-0.02em",
        }}
      >
        Docent
      </span>
    </span>
  );
}
