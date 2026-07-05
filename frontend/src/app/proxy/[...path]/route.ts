// Dev-only backend proxy. The browser calls /proxy/* (same-origin, no CORS) and
// this handler forwards the request to the real backend (BACKEND_PROXY_TARGET),
// then returns the backend's response body as a stream — so Server-Sent Events
// (the /ask/* token stream) pass through UNBUFFERED and arrive token-by-token.
// In production BACKEND_PROXY_TARGET is unset and the frontend calls the backend
// directly via NEXT_PUBLIC_API_URL, so this route is never used.

const TARGET = process.env.BACKEND_PROXY_TARGET;

export const dynamic = "force-dynamic";

async function handler(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  if (!TARGET) {
    return new Response("BACKEND_PROXY_TARGET is not set", { status: 500 });
  }

  const { path } = await ctx.params;
  const search = new URL(req.url).search;
  const url = `${TARGET}/${path.join("/")}${search}`;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const upstream = await fetch(url, {
    method: req.method,
    headers: req.headers.get("content-type")
      ? { "content-type": req.headers.get("content-type")! }
      : undefined,
    body: hasBody ? await req.arrayBuffer() : undefined,
  });

  // Stream the body straight through (do NOT await/buffer it).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const PUT = handler;
