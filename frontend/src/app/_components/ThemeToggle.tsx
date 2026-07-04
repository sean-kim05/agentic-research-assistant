"use client";

import { useTheme } from "@/lib/theme";

// Half-filled circle that flips light/dark. Used in the sidebar footer and the
// chat header; both share state through the useTheme hook.
export default function ThemeToggle({ size = 32 }: { size?: number }) {
  const { toggle } = useTheme();
  const icon = Math.round(size * 0.5);
  return (
    <button
      onClick={toggle}
      title="Toggle theme"
      aria-label="Toggle theme"
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: "1px solid var(--line2)",
        background: "transparent",
        color: "var(--ink2)",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 000 16z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
