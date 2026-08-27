import { type NextRequest, NextResponse } from "next/server";
import { SsrfBlockedError, ssrfSafeFetch } from "@/lib/webdav/ssrf-guard";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

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

// App Router only exports standard HTTP methods; non-standard WebDAV methods arrive via POST.
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
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Restrict to same-origin requests to prevent open proxy abuse.
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

  const limited = await enforceRateLimit("webdav", getClientIp(request));
  if (limited) return limited;

  const webdavBaseUrl = request.headers.get("X-WebDAV-URL");
  if (!webdavBaseUrl) {
    return NextResponse.json(
      { error: "Missing X-WebDAV-URL header" },
      { status: 400 },
    );
  }

  const path = params.path?.join("/") ?? "";
  const targetUrl = `${webdavBaseUrl.replace(/\/$/, "")}/${path}`;

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

  const body =
    method !== "GET" && method !== "HEAD" && method !== "OPTIONS"
      ? await request.arrayBuffer()
      : undefined;

  try {
    const response = await ssrfSafeFetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body,
    });

    const responseBody = await response.arrayBuffer();
    const responseHeaders = new Headers();

    for (const [key, value] of response.headers.entries()) {
      const lower = key.toLowerCase();
      if (lower === "transfer-encoding") continue; // not valid in HTTP/2
      responseHeaders.set(key, value);
    }

    // Response constructor throws if 204/205/304 receive a non-null body.
    const isNullBodyStatus = [204, 205, 304].includes(response.status);

    return new NextResponse(isNullBodyStatus ? null : responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown proxy error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
