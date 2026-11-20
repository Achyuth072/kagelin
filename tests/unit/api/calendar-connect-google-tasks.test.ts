import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  cookieStore: new Map<string, { value: string; options?: unknown }>(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      h.cookieStore.has(name) ? h.cookieStore.get(name) : undefined,
    set: (name: string, value: string, options?: unknown) => {
      h.cookieStore.set(name, { value, options });
    },
    delete: (name: string) => {
      h.cookieStore.delete(name);
    },
  })),
}));

vi.mock("@/lib/api/require-user", () => ({
  requireUser: vi.fn(async () => ({ user: { id: "user-123" }, error: null })),
}));

vi.mock("@/lib/calendar-oauth/pkce", () => ({
  generatePKCE: vi.fn(async () => ({
    codeVerifier: "mock-verifier",
    codeChallenge: "mock-challenge",
  })),
}));

import { GET } from "@/../app/api/calendar/connect/[provider]/route";

describe("GET /api/calendar/connect/google_tasks", () => {
  beforeEach(() => {
    h.cookieStore.clear();
    process.env.NEXT_PUBLIC_APP_URL = "https://kagelin.app";
    process.env.GOOGLE_CLIENT_ID = "mock-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "mock-google-secret";
  });

  it("redirects to Google OAuth with tasks.readonly scope and sets state cookies", async () => {
    const res = await GET(
      new Request("https://kagelin.app/api/calendar/connect/google_tasks"),
      { params: Promise.resolve({ provider: "google_tasks" }) },
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeTruthy();
    const url = new URL(location!);

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/tasks.readonly openid email",
    );
    expect(url.searchParams.get("client_id")).toBe("mock-google-client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");

    expect(h.cookieStore.get("calendar_oauth_provider")?.value).toBe(
      "google_tasks",
    );
    expect(h.cookieStore.get("calendar_oauth_verifier")?.value).toBe(
      "mock-verifier",
    );
    expect(h.cookieStore.has("calendar_oauth_state")).toBe(true);
  });

  it("preserves validated return_to matching /settings?tab=... in cookie", async () => {
    const returnPath = "/settings?tab=backup&migration=google_tasks";
    const res = await GET(
      new Request(
        `https://kagelin.app/api/calendar/connect/google_tasks?return_to=${encodeURIComponent(returnPath)}`,
      ),
      { params: Promise.resolve({ provider: "google_tasks" }) },
    );

    expect(res.status).toBe(307);
    expect(h.cookieStore.get("calendar_oauth_return_to")?.value).toBe(
      returnPath,
    );
  });

  it("ignores invalid or open-redirect return_to parameter", async () => {
    const evilPaths = [
      "https://evil.com/phish",
      "//evil.com",
      "/dashboard",
      "/calendar",
      "javascript:alert(1)",
    ];

    for (const evilPath of evilPaths) {
      h.cookieStore.clear();
      await GET(
        new Request(
          `https://kagelin.app/api/calendar/connect/google_tasks?return_to=${encodeURIComponent(evilPath)}`,
        ),
        { params: Promise.resolve({ provider: "google_tasks" }) },
      );
      expect(h.cookieStore.has("calendar_oauth_return_to")).toBe(false);
    }
  });
});
