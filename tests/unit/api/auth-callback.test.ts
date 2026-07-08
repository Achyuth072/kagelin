import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExchangeCodeForSession = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

import { GET } from "@/../app/auth/callback/route";

function request(query: string) {
  return new Request(`http://localhost/auth/callback${query}`);
}

describe("GET /auth/callback (H-3)", () => {
  beforeEach(() => {
    mockExchangeCodeForSession.mockReset();
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("redirects to the sanitized next path on success", async () => {
    const response = await GET(request("?code=abc&next=/settings"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/settings");
  });

  it("defaults to / when next is absent", async () => {
    const response = await GET(request("?code=abc"));
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("strips a protocol-relative //host next param down to /", async () => {
    const response = await GET(
      request("?code=abc&next=%2F%2Fevil.com%2Fphish"),
    );
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("strips a backslash next param down to /", async () => {
    const response = await GET(request("?code=abc&next=%2F%5Cevil.com"));
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("ignores an absolute-URL next param", async () => {
    const response = await GET(
      request("?code=abc&next=https%3A%2F%2Fevil.com"),
    );
    expect(response.headers.get("location")).toBe("http://localhost/");
  });
});
