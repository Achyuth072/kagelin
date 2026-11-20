import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  cookieStore: new Map<string, { value: string; options?: unknown }>(),
  upsertCalled: false,
  capturedUpsertData: null as unknown,
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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-test-uuid" } },
      })),
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      upsert: vi.fn(async (data: unknown) => {
        if (table === "calendar_oauth_tokens") {
          h.upsertCalled = true;
          h.capturedUpsertData = data;
        }
        return { error: null };
      }),
    })),
  })),
}));

vi.mock("@/lib/calendar-oauth/auth-code-exchange", () => ({
  exchangeAuthCode: vi.fn(async () => ({
    accessToken: "mock-google-tasks-access-token",
    refreshToken: "mock-google-tasks-refresh-token",
    expiresAt: Date.now() + 3600 * 1000,
  })),
}));

vi.mock("@/lib/calendar-oauth/token-crypto", () => ({
  encryptRefreshToken: vi.fn(async () => ({
    ciphertext: "mock-ciphertext",
    iv: "mock-iv",
  })),
}));

import { GET } from "@/../app/api/calendar/oauth/callback/route";

describe("GET /api/calendar/oauth/callback (google_tasks ephemeral OAuth)", () => {
  beforeEach(() => {
    h.cookieStore.clear();
    h.upsertCalled = false;
    h.capturedUpsertData = null;
    process.env.NEXT_PUBLIC_APP_URL = "https://kagelin.app";
    process.env.CALENDAR_TOKEN_ENC_KEY = "mock-enc-key";
  });

  it("exchanges auth code, delivers ephemeral cookie, performs zero DB upserts, and redirects to return_to", async () => {
    h.cookieStore.set("calendar_oauth_state", { value: "test-state-123" });
    h.cookieStore.set("calendar_oauth_verifier", {
      value: "test-verifier-456",
    });
    h.cookieStore.set("calendar_oauth_provider", { value: "google_tasks" });
    h.cookieStore.set("calendar_oauth_return_to", {
      value: "/settings?tab=backup&migration=google_tasks",
    });

    const res = await GET(
      new Request(
        "https://kagelin.app/api/calendar/oauth/callback?code=mock-code&state=test-state-123",
      ),
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeTruthy();
    const url = new URL(location!);

    // Redirects to return_to with connected flag
    expect(url.pathname).toBe("/settings");
    expect(url.searchParams.get("tab")).toBe("backup");
    expect(url.searchParams.get("migration")).toBe("google_tasks");

    // Zero persistence in calendar_oauth_tokens
    expect(h.upsertCalled).toBe(false);
    expect(h.capturedUpsertData).toBeNull();

    // Ephemeral access token cookie delivered
    const tempCookie = h.cookieStore.get("google_tasks_temp_token");
    expect(tempCookie).toBeDefined();
    expect(tempCookie?.value).toBe("mock-google-tasks-access-token");
    expect((tempCookie?.options as { maxAge?: number })?.maxAge).toBe(600);

    // OAuth state cookies cleaned up
    expect(h.cookieStore.has("calendar_oauth_state")).toBe(false);
    expect(h.cookieStore.has("calendar_oauth_verifier")).toBe(false);
    expect(h.cookieStore.has("calendar_oauth_provider")).toBe(false);
    expect(h.cookieStore.has("calendar_oauth_return_to")).toBe(false);
  });

  it("falls back to /settings?tab=backup when return_to cookie is not present", async () => {
    h.cookieStore.set("calendar_oauth_state", { value: "test-state-abc" });
    h.cookieStore.set("calendar_oauth_verifier", {
      value: "test-verifier-abc",
    });
    h.cookieStore.set("calendar_oauth_provider", { value: "google_tasks" });

    const res = await GET(
      new Request(
        "https://kagelin.app/api/calendar/oauth/callback?code=mock-code&state=test-state-abc",
      ),
    );

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    const url = new URL(location!);
    expect(url.pathname).toBe("/settings");
    expect(url.searchParams.get("tab")).toBe("backup");
    expect(url.searchParams.get("connected")).toBe("google_tasks");
    expect(h.upsertCalled).toBe(false);
  });
});
