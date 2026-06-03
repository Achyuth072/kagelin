import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PullMutations } from "@/lib/sync/pull-merge";

const { capturedInserts, capturedUpdates, capturedDeletes } = vi.hoisted(() => {
  // capturedInserts holds individual rows (batch inserts are flattened in)
  const capturedInserts: unknown[] = [];
  const capturedUpdates: Array<{ data: Record<string, unknown>; id: string }> = [];
  const capturedDeletes: string[] = [];
  return { capturedInserts, capturedUpdates, capturedDeletes };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: (data: unknown) => {
        if (Array.isArray(data)) capturedInserts.push(...data);
        else capturedInserts.push(data);
        return Promise.resolve({ error: null });
      },
      update: (data: Record<string, unknown>) => ({
        // Per-row update (toUpdate / toAdopt)
        eq: (_col: string, id: string) => {
          capturedUpdates.push({ data, id });
          return Promise.resolve({ error: null });
        },
        // Batched update (toArchive) — record one entry per id
        in: (_col: string, ids: string[]) => {
          ids.forEach((id) => capturedUpdates.push({ data, id }));
          return Promise.resolve({ error: null });
        },
      }),
      delete: () => ({
        // Batched delete (toHardDelete)
        in: (_col: string, ids: string[]) => {
          capturedDeletes.push(...ids);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  }),
}));

const mockCalendar = { id: "cal-1", user_id: "user-1" };

describe("applyPullMutations", () => {
  beforeEach(() => {
    capturedInserts.length = 0;
    capturedUpdates.length = 0;
    capturedDeletes.length = 0;
  });

  it("toCreate inserts with remote_id and etag as top-level columns, not in metadata", async () => {
    const { applyPullMutations } = await import("@/lib/sync/orchestrator");

    const mutations: PullMutations = {
      toCreate: [{ title: "Meeting", start_time: "2026-06-01T10:00:00Z", end_time: "2026-06-01T11:00:00Z", remote_id: "remote-1", etag: "etag-1" }],
      toUpdate: [],
      toArchive: [],
      toHardDelete: [],
      toAdopt: [],
    };

    const result = await applyPullMutations(mutations, mockCalendar);

    expect(capturedInserts).toHaveLength(1);
    expect(capturedInserts[0]).toMatchObject({ remote_id: "remote-1", etag: "etag-1", user_id: "user-1", remote_calendar_id: "cal-1" });
    expect((capturedInserts[0] as Record<string, unknown>)?.metadata ?? {}).not.toHaveProperty("remote_id");
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("toUpdate writes etag and clearSyncState=true sets sync_state null", async () => {
    const { applyPullMutations } = await import("@/lib/sync/orchestrator");

    const mutations: PullMutations = {
      toCreate: [],
      toUpdate: [{ id: "local-1", data: { title: "Updated", start_time: "2026-06-01T10:00:00Z", end_time: "2026-06-01T11:00:00Z" }, etag: "etag-2", clearSyncState: true }],
      toArchive: [],
      toHardDelete: [],
      toAdopt: [],
    };

    const result = await applyPullMutations(mutations, mockCalendar);

    expect(capturedUpdates).toContainEqual(
      expect.objectContaining({ id: "local-1", data: expect.objectContaining({ etag: "etag-2", sync_state: null }) }),
    );
    expect(result.updated).toBe(1);
  });

  it("toArchive sets is_archived true", async () => {
    const { applyPullMutations } = await import("@/lib/sync/orchestrator");

    const mutations: PullMutations = {
      toCreate: [],
      toUpdate: [],
      toArchive: ["local-2"],
      toHardDelete: [],
      toAdopt: [],
    };

    await applyPullMutations(mutations, mockCalendar);

    expect(capturedUpdates).toContainEqual(
      expect.objectContaining({ id: "local-2", data: expect.objectContaining({ is_archived: true }) }),
    );
  });

  it("toHardDelete removes the row", async () => {
    const { applyPullMutations } = await import("@/lib/sync/orchestrator");

    const mutations: PullMutations = {
      toCreate: [],
      toUpdate: [],
      toArchive: [],
      toHardDelete: ["local-3"],
      toAdopt: [],
    };

    await applyPullMutations(mutations, mockCalendar);

    expect(capturedDeletes).toContain("local-3");
  });

  it("toAdopt writes remote_id and etag and clears sync_state", async () => {
    const { applyPullMutations } = await import("@/lib/sync/orchestrator");

    const mutations: PullMutations = {
      toCreate: [],
      toUpdate: [],
      toArchive: [],
      toHardDelete: [],
      toAdopt: [{ id: "local-4", remote_id: "remote-new", etag: "etag-new" }],
    };

    await applyPullMutations(mutations, mockCalendar);

    expect(capturedUpdates).toContainEqual(
      expect.objectContaining({ id: "local-4", data: expect.objectContaining({ remote_id: "remote-new", etag: "etag-new", sync_state: null }) }),
    );
  });
});
