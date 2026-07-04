import type { NextConfig } from "next";

// Optional dev proxy: when BACKEND_PROXY_TARGET is set (see .env.local), browser
// calls to /proxy/* are reverse-proxied by the Next server to the real backend.
// Because that hop is server-to-server, it sidesteps CORS entirely — so local dev
// can talk to the live Render backend without adding localhost to its allowlist.
// In production BACKEND_PROXY_TARGET is unset, so this is a no-op and the frontend
// calls the backend directly via NEXT_PUBLIC_API_URL.
const proxyTarget = process.env.BACKEND_PROXY_TARGET;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!proxyTarget) return [];
    return [{ source: "/proxy/:path*", destination: `${proxyTarget}/:path*` }];
  },
};

export default nextConfig;
