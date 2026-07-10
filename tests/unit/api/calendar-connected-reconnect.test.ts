import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  tokenRows: [] as { provider: string }[],
  calendarRows: [] as { provider: string }[],
  user: { id: "user-1" } as { id: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: h.user } })) },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      const result =
        table === "calendar_oauth_tokens"
          ? { data: h.tokenRows }
          : { data: h.calendarRows };
      const chain = {
        select: () => chain,
        eq: () => Promise.resolve(result),
      };
      return chain;
    },
  })),
}));

import { GET } from "@/../app/api/calendar/connected/route";

async function call() {
  const res = await GET();
  return (await res.json()) as {
    providers: string[];
    needsReconnect: string[];
  };
}

describe("GET /api/calendar/connected — needsReconnect (#57)", () => {
  beforeEach(() => {
    h.tokenRows = [];
    h.calendarRows = [];
    h.user = { id: "user-1" };
  });

  it("returns empty arrays when unauthenticated", async () => {
    h.user = null;
    expect(await call()).toEqual({ providers: [], needsReconnect: [] });
  });

  it("does not flag a healthy connection (token + calendars present)", async () => {
    h.tokenRows = [{ provider: "google" }];
    h.calendarRows = [{ provider: "google" }];
    expect(await call()).toEqual({
      providers: ["google"],
      needsReconnect: [],
    });
  });

  it("flags reconnect when calendars exist but the token row is gone (revoked)", async () => {
    h.tokenRows = [];
    h.calendarRows = [{ provider: "google" }];
    expect(await call()).toEqual({
      providers: [],
      needsReconnect: ["google"],
    });
  });

  it("deduplicates multiple calendars of the same revoked provider", async () => {
    h.tokenRows = [];
    h.calendarRows = [{ provider: "google" }, { provider: "google" }];
    expect(await call()).toEqual({
      providers: [],
      needsReconnect: ["google"],
    });
  });

  it("only flags OAuth providers (a non-OAuth calendar row is never a reconnect)", async () => {
    h.tokenRows = [];
    h.calendarRows = [{ provider: "icloud" }];
    const result = await call();
    expect(result.needsReconnect).toEqual([]);
  });
});
