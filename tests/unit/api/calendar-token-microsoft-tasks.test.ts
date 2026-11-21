import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  cookieStore: new Map<string, { value: string; options?: unknown }>(),
  user: { id: "user-123" } as { id: string } | null,
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
  requireUser: vi.fn(async () => {
    if (!h.user) {
      return {
        user: null,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      };
    }
    return { user: h.user, error: null };
  }),
}));

vi.mock("@/lib/calendar-oauth/get-access-token", () => ({
  getProviderAccessToken: vi.fn(async () => {
    throw new Error(
      "getProviderAccessToken should not be called for microsoft_tasks",
    );
  }),
}));

import { GET } from "@/../app/api/calendar/token/route";

describe("GET /api/calendar/token (microsoft_tasks ephemeral OAuth token pull)", () => {
  beforeEach(() => {
    h.cookieStore.clear();
    h.user = { id: "user-123" };
  });

  it("pops and deletes ephemeral cookie, returning bearer token without database access", async () => {
    h.cookieStore.set("microsoft_tasks_temp_token", {
      value: "ephemeral-token-xyz",
    });

    const res = await GET(
      new Request(
        "https://kagelin.app/api/calendar/token?provider=microsoft_tasks",
      ),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      access_token?: string;
      expires_at?: number;
      accessToken?: string;
      expiresAt?: number;
    };

    expect(body.access_token).toBe("ephemeral-token-xyz");
    expect(body.accessToken).toBe("ephemeral-token-xyz");
    expect(body.expires_at).toBeGreaterThan(Date.now());
    expect(body.expiresAt).toBeGreaterThan(Date.now());

    // Transient cookie is deleted immediately upon consumption
    expect(h.cookieStore.has("microsoft_tasks_temp_token")).toBe(false);
  });

  it("returns 401 disconnected when ephemeral cookie is absent or expired", async () => {
    const res = await GET(
      new Request(
        "https://kagelin.app/api/calendar/token?provider=microsoft_tasks",
      ),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { disconnected?: boolean };
    expect(body.disconnected).toBe(true);
  });

  it("returns 401 when user is not authenticated", async () => {
    h.user = null;
    const res = await GET(
      new Request(
        "https://kagelin.app/api/calendar/token?provider=microsoft_tasks",
      ),
    );

    expect(res.status).toBe(401);
  });
});
