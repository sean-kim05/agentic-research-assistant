// Single source of truth for the backend base URL.
// NEXT_PUBLIC_ prefix = value is inlined into the browser bundle.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
