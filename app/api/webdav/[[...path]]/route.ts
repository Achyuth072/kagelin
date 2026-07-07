import { type NextRequest, NextResponse } from "next/server";
import { Agent, fetch as undiciFetch } from "undici";
import {
  pinnedLookup,
  resolveSafeTarget,
  SsrfBlockedError,
} from "@/lib/webdav/ssrf-guard";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponseHeaders,
} from "@/lib/rate-limit";

/**
 * WebDAV Proxy Route
 *
 * Forwards all WebDAV method requests to the configured WebDAV server
 * from the server side, bypassing browser CORS restrictions.
 *
 * This is the correct architectural pattern: user-supplied WebDAV servers
 * (Nextcloud, Synology, etc.) will never set CORS headers for our domain.
 * Server-side proxying is the only robust solution.
 *
 * Usage: client sends requests to /api/webdav/<path>
 *  with headers:
 *    X-WebDAV-URL: <full base url of their webdav server>
 *    Authorization: Basic <base64 credentials>
 *
 * Deliberately unauthenticated (guest backup depends on it), so it is its
 * own last line of defense against SSRF: the target host is resolved once,
 * checked against private/link-local/metadata ranges, and the connection is
 * pinned to that exact IP (see `ssrf-guard.ts`) rather than re-resolved —
 * closing the DNS-rebinding TOCTOU a plain allow/deny-by-hostname check has.
 * Redirects are never auto-followed, for the same reason.
 */

const ALLOWED_METHODS = [
  "GET",
  "PUT",
  "DELETE",
  "PROPFIND",
  "PROPPATCH",
  "MKCOL",
  "COPY",
  "MOVE",
  "OPTIONS",
  "REPORT",
  "HEAD",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyWebDAV(request, await params, "GET");
}
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyWebDAV(request, await params, "PUT");
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyWebDAV(request, await params, "DELETE");
}
export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return proxyWebDAV(request, await params, "OPTIONS");
}

/**
 * Handle WebDAV-specific methods (PROPFIND, MKCOL, etc.)
 * Next.js only allows standard HTTP methods as named exports. For everything else,
 * we catch them in the POST handler and check the actual method from the request.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const method = request.method;
  return proxyWebDAV(request, await params, method);
}

async function proxyWebDAV(
  request: NextRequest,
  params: { path?: string[] },
  method: string,
): Promise<NextResponse> {
  // Guard: only allow known WebDAV-safe methods
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Same-origin guard: this route is unauthenticated by design, so it must
  // not act as an open proxy for other sites' scripts. Browsers set these
  // headers on fetches whenever possible; if either is present it must say
  // the request came from our own origin.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed" },
      { status: 403 },
    );
  }
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin") {
    return NextResponse.json(
      { error: "Cross-site requests are not allowed" },
      { status: 403 },
    );
  }

  // H-5 / N-3: unauthenticated route, so rate limit by IP.
  const rateLimit = await checkRateLimit("webdav", getClientIp(request), {
    maxRequests: 60,
    window: "1 m",
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitResponseHeaders(rateLimit) },
    );
  }

  // The client passes the WebDAV server base URL via a custom header
  const webdavBaseUrl = request.headers.get("X-WebDAV-URL");
  if (!webdavBaseUrl) {
    return NextResponse.json(
      { error: "Missing X-WebDAV-URL header" },
      { status: 400 },
    );
  }

  let safeTarget;
  try {
    safeTarget = await resolveSafeTarget(webdavBaseUrl);
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  // Reconstruct the target URL
  const path = params.path?.join("/") ?? "";
  const targetUrl = `${webdavBaseUrl.replace(/\/$/, "")}/${path}`;

  // Forward all headers except host-specific ones
  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === "host" ||
      lower === "x-webdav-url" ||
      lower === "connection"
    ) {
      continue;
    }
    forwardHeaders.set(key, value);
  }

  // Forward the body (required for PUT, PROPFIND etc.)
  const body =
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS"
      ? await request.arrayBuffer()
      : undefined;

  // Pin the connection to the exact IP validated above — never re-resolve
  // the hostname, or a DNS-rebinding attacker can swap in a private/metadata
  // address between the check and the actual connect.
  const dispatcher = new Agent({
    connect: { lookup: pinnedLookup(safeTarget.pinnedIp, safeTarget.family) },
  });

  try {
    const response = await undiciFetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: body ?? null,
      dispatcher,
      // Never auto-follow redirects: a redirect response could point at a
      // private/metadata address, and following it would re-resolve DNS
      // (and lose the pin above). Pass 3xx responses straight through.
      redirect: "manual",
      duplex: "half",
    });

    const responseBody = await response.arrayBuffer();
    const responseHeaders = new Headers();

    // Forward response headers back to client
    for (const [key, value] of response.headers.entries()) {
      const lower = key.toLowerCase();
      if (lower === "transfer-encoding") continue; // not valid in HTTP/2
      responseHeaders.set(key, value);
    }

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown proxy error";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await dispatcher.close();
  }
}
