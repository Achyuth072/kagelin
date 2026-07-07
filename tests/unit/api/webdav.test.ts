import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockUndiciFetch = vi.fn();
const mockAgentClose = vi.fn();
let lastAgentOptions: unknown;

vi.mock("undici", () => ({
  fetch: (...args: unknown[]) => mockUndiciFetch(...args),
  Agent: vi.fn().mockImplementation(function (this: unknown, options: unknown) {
    lastAgentOptions = options;
    return { close: mockAgentClose };
  }),
}));

const mockResolveSafeTarget = vi.fn();

vi.mock("@/lib/webdav/ssrf-guard", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/webdav/ssrf-guard")
  >("@/lib/webdav/ssrf-guard");
  return {
    ...actual,
    resolveSafeTarget: (...args: unknown[]) => mockResolveSafeTarget(...args),
  };
});

const mockCheckRateLimit = vi.fn();

vi.mock("@/lib/rate-limit", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/rate-limit")>(
      "@/lib/rate-limit",
    );
  return {
    ...actual,
    checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
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
    mockUndiciFetch.mockReset();
    mockAgentClose.mockReset();
    mockResolveSafeTarget.mockReset();
    mockCheckRateLimit.mockReset();
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    lastAgentOptions = undefined;
  });

  it("returns 429 when the IP rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 1000,
    });

    const request = makeRequest("OPTIONS");
    const response = await OPTIONS(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(429);
    expect(mockResolveSafeTarget).not.toHaveBeenCalled();
  });

  it("rejects methods outside the WebDAV allowlist", async () => {
    const request = makeRequest("PATCH");
    const response = await POST(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(405);
    expect(mockResolveSafeTarget).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin Origin header", async () => {
    const request = makeRequest("OPTIONS", {
      Origin: "https://evil.example.com",
    });
    const response = await OPTIONS(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(mockResolveSafeTarget).not.toHaveBeenCalled();
  });

  it("rejects a cross-site Sec-Fetch-Site", async () => {
    const request = makeRequest("OPTIONS", {
      "Sec-Fetch-Site": "cross-site",
    });
    const response = await OPTIONS(request, { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(mockResolveSafeTarget).not.toHaveBeenCalled();
  });

  it("allows a matching same-origin Origin + Sec-Fetch-Site", async () => {
    mockResolveSafeTarget.mockResolvedValue({
      url: new URL("https://dav.example.com"),
      pinnedIp: "93.184.216.34",
      family: 4,
    });
    mockUndiciFetch.mockResolvedValue(
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

  it("blocks SSRF targets surfaced by resolveSafeTarget (e.g. metadata IP)", async () => {
    mockResolveSafeTarget.mockRejectedValue(
      new SsrfBlockedError("WebDAV server resolves to a disallowed address"),
    );

    const request = makeRequest("OPTIONS");
    const response = await OPTIONS(request, { params: Promise.resolve({}) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("disallowed address");
    expect(mockUndiciFetch).not.toHaveBeenCalled();
  });

  it("pins the connection to the resolved IP and never auto-follows redirects", async () => {
    mockResolveSafeTarget.mockResolvedValue({
      url: new URL("https://dav.example.com"),
      pinnedIp: "93.184.216.34",
      family: 4,
    });
    mockUndiciFetch.mockResolvedValue(
      new Response("body", { status: 207, headers: { "X-Test": "1" } }),
    );

    const request = makeRequest("OPTIONS");
    const response = await OPTIONS(request, {
      params: Promise.resolve({ path: ["foo"] }),
    });

    expect(response.status).toBe(207);
    expect(mockUndiciFetch).toHaveBeenCalledWith(
      "https://dav.example.com/foo",
      expect.objectContaining({ redirect: "manual", method: "OPTIONS" }),
    );
    expect(lastAgentOptions).toEqual(
      expect.objectContaining({
        connect: expect.objectContaining({ lookup: expect.any(Function) }),
      }),
    );
    expect(mockAgentClose).toHaveBeenCalled();
  });
});
