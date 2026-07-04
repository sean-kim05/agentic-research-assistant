"use client";

// Tiny theme store backed by [data-theme] on <html> + localStorage. Multiple
// toggle buttons (sidebar + chat header) stay in sync by subscribing to a
// "theme-changed" window event via useSyncExternalStore. The pre-paint init
// lives in app/layout.tsx.

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

function subscribe(onChange: () => void) {
  window.addEventListener("theme-changed", onChange);
  return () => window.removeEventListener("theme-changed", onChange);
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

// Server render (and first client paint) assume light; the pre-paint script has
// already set the real attribute, and useSyncExternalStore reconciles on mount.
function getServerSnapshot(): Theme {
  return "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage may be unavailable (private mode) — theme still applies visually
    }
    window.dispatchEvent(new Event("theme-changed"));
  };

  return { theme, toggle };
}
