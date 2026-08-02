import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  dbError: null as { message: string } | null,
  adminError: null as { message: string } | null,
  counts: {} as Record<string, number>,
  gteColumns: {} as Record<string, string>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => Promise.resolve({ error: h.dbError }),
    }),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => {
      let status = "";
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: string) => {
          if (column === "status") status = value;
          return builder;
        }),
        gte: vi.fn((column: string) => {
          h.gteColumns[status] = column;
          return builder;
        }),
        or: vi.fn(() => builder),
        then: (
          resolve: (result: {
            count: number | null;
            error: { message: string } | null;
          }) => void,
        ) =>
          resolve(
            h.adminError
              ? { count: null, error: h.adminError }
              : { count: h.counts[status] ?? 0, error: null },
          ),
      };
      return builder;
    }),
  })),
}));

import { GET } from "@/../app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    h.dbError = null;
    h.adminError = null;
    h.counts = {};
    h.gteColumns = {};
  });

  it("returns 200 ok when the database is reachable and deliveries are healthy", async () => {
    h.counts = { sent: 12, failed: 1, pending: 0 };

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      notifications: { sent: 12, failed: 1, pending: 0 },
    });
  });

  it("returns 503 when the database query errors", async () => {
    h.dbError = { message: "connection refused" };

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      database: "unreachable",
    });
  });

  it("returns 200 degraded when sustained zero-delivery is detected", async () => {
    h.counts = { sent: 0, failed: 3, pending: 4 };

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "degraded",
      notifications: { sent: 0, failed: 3, pending: 4 },
    });
  });

  it("returns 503 when a notification_queue query errors", async () => {
    h.adminError = { message: "permission denied" };

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "error",
      database: "unreachable",
    });
  });

  it("windows the sent count on sent_at, not the immutable scheduled_at", async () => {
    h.counts = { sent: 1, failed: 0, pending: 0 };

    await GET();

    expect(h.gteColumns.sent).toBe("sent_at");
    expect(h.gteColumns.failed).toBe("scheduled_at");
    expect(h.gteColumns.pending).toBe("scheduled_at");
  });
});
