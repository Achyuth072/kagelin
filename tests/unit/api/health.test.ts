import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  error: null as { message: string } | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => Promise.resolve({ error: h.error }),
    }),
  })),
}));

import { GET } from "@/../app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    h.error = null;
  });

  it("returns 200 ok when the database is reachable", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns 503 when the database query errors", async () => {
    h.error = { message: "connection refused" };
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      database: "unreachable",
    });
  });
});
