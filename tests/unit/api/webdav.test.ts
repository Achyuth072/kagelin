import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockSsrfSafeFetch = vi.fn();

vi.mock("@/lib/webdav/ssrf-guard", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/webdav/ssrf-guard")
  >("@/lib/webdav/ssrf-guard");
  return {
    ...actual,
    ssrfSafeFetch: (...args: unknown[]) => mockSsrfSafeFetch(...args),
  };
});

const mockEnforceRateLimit = vi.fn();

vi.mock("@/lib/rate-limit", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/rate-limit")>(
      "@/lib/rate-limit",
    );
  return {
    ...actual,
    enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
  };
});

import { POST, OPTIONS } from "@/../app/api/webdav/[[...path]]/route";
import { SsrfBlockedError } from "@/lib/webdav/ssrf-guard";

function makeRequest(
  method: string,
  headers: Record<string, string> = {},
  path = "foo",
) {
  return new NextRequest(`http://localhost/api/webdav/${path}`, {
    method,
    headers: { "X-WebDAV-URL": "https://dav.example.com", ...headers },
  });
}

describe("WebDAV proxy route (C-3)", () => {
  beforeEach(() => {
    mockSsrfSafeFetch.mockReset();
    mockEnforceRateLimit.mockReset();
    mockEnforceRateLimit.mockResolvedValue(null);
  });

  it("returns 429 when the IP rate limit is exceeded", async () => {
    mockEnforceRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );

    const request = makeRequest("OPTIONS");
    const response = await OPTIONS(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(429);
    expect(mockSsrfSafeFetch).not.toHaveBeenCalled();
  });

  it("rejects methods outside the WebDAV allowlist", async () => {
    const request = makeRequest("PATCH");
    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(405);
    expect(mockSsrfSafeFetch).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin Origin header", async () => {
    const request = makeRequest("OPTIONS", {
      Origin: "https://evil.example.com",
    });
    const response = await OPTIONS(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(mockSsrfSafeFetch).not.toHaveBeenCalled();
  });

  it("rejects a cross-site Sec-Fetch-Site", async () => {
    const request = makeRequest("OPTIONS", {
      "Sec-Fetch-Site": "cross-site",
    });
    const response = await OPTIONS(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(mockSsrfSafeFetch).not.toHaveBeenCalled();
  });

  it("allows a matching same-origin Origin + Sec-Fetch-Site", async () => {
    mockSsrfSafeFetch.mockResolvedValue(
      new Response("ok", { status: 200, headers: {} }),
    );

    const request = makeRequest("OPTIONS", {
      Origin: "http://localhost",
      "Sec-Fetch-Site": "same-origin",
    });
    const response = await OPTIONS(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
  });

  it("returns 400 when X-WebDAV-URL is missing", async () => {
    const request = new NextRequest("http://localhost/api/webdav/foo", {
      method: "OPTIONS",
    });
    const response = await OPTIONS(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
  });

  it("blocks SSRF targets surfaced by ssrfSafeFetch (e.g. metadata IP)", async () => {
    mockSsrfSafeFetch.mockRejectedValue(
      new SsrfBlockedError("WebDAV server resolves to a disallowed address"),
    );

    const request = makeRequest("OPTIONS");
    const response = await OPTIONS(request, { params: Promise.resolve({}) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("disallowed address");
  });

  it("returns 502 when the upstream fetch fails", async () => {
    mockSsrfSafeFetch.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const request = makeRequest("OPTIONS");
    const response = await OPTIONS(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(502);
  });

  it("forwards the request through ssrfSafeFetch and passes the response back", async () => {
    mockSsrfSafeFetch.mockResolvedValue(
      new Response("body", { status: 207, headers: { "X-Test": "1" } }),
    );

    const request = makeRequest("OPTIONS");
    const response = await OPTIONS(request, {
      params: Promise.resolve({ path: ["foo"] }),
    });

    expect(response.status).toBe(207);
    expect(response.headers.get("X-Test")).toBe("1");
    expect(mockSsrfSafeFetch).toHaveBeenCalledWith(
      "https://dav.example.com/foo",
      expect.objectContaining({ method: "OPTIONS" }),
    );
  });
});
