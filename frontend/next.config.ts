import type { NextConfig } from "next";

// Local dev reaches the backend through the streaming proxy route handler at
// src/app/proxy/[...path]/route.ts (see .env.local's BACKEND_PROXY_TARGET) —
// that hop is server-to-server, so it avoids CORS AND passes SSE through
// unbuffered (a next.config `rewrites()` proxy buffers streamed responses).
// In production BACKEND_PROXY_TARGET is unset and the frontend calls the
// backend directly via NEXT_PUBLIC_API_URL.
const nextConfig: NextConfig = {};

export default nextConfig;
