import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PullMutations } from "@/lib/sync/pull-merge";

const { capturedInserts, capturedUpdates, capturedDeletes, mockExistingRows } =
  vi.hoisted(() => {
    const capturedInserts: unknown[] = [];
    const capturedUpdates: Array<{
      data: Record<string, unknown>;
      id: string;
    }> = [];
    const capturedDeletes: string[] = [];
    // Controls what the dedup SELECT returns — rows that already own a remote_id
    // for this user. `is_archived` distinguishes an event still active in another
    // calendar (skip) from an orphan left by a disconnect (revive).
    const mockExistingRows: Array<{
      id: string;
      remote_id: string;
      is_archived: boolean;
    }> = [];
    return {
      capturedInserts,
      capturedUpdates,
      capturedDeletes,
      mockExistingRows,
    };
  });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      // Dedup: SELECT id, remote_id, is_archived … .eq(user_id).in(remote_id, [...])
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          in: (_col2: string, _ids: string[]) =>
            Promise.resolve({
              data: mockExistingRows,
              error: null,
            }),
        }),
      }),
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
        // Batched update (toArchive)
        in: (_col: string, ids: string[]) => {
          ids.forEach((id) => capturedUpdates.push({ data, id }));
          return Promise.resolve({ error: null });
        },
      }),
      delete: () => ({
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
    mockExistingRows.length = 0;
  });

  it("toCreate inserts with remote_id and etag as top-level columns, not in metadata", async () => {
    const { applyPullMutations } = await import("@/lib/sync/orchestrator");

    const mutations: PullMutations = {
      toCreate: [
        {
          title: "Meeting",
          start_time: "2026-06-01T10:00:00Z",
          end_time: "2026-06-01T11:00:00Z",
          remote_id: "remote-1",
          etag: "etag-1",
        },
      ],
      toUpdate: [],
      toArchive: [],
      toHardDelete: [],
      toAdopt: [],
    };

    const result = await applyPullMutations(mutations, mockCalendar);

    expect(capturedInserts).toHaveLength(1);
    expect(capturedInserts[0]).toMatchObject({
      remote_id: "remote-1",
      etag: "etag-1",
      user_id: "user-1",
      remote_calendar_id: "cal-1",
    });
    expect(
      (capturedInserts[0] as Record<string, unknown>)?.metadata ?? {},
    ).not.toHaveProperty("remote_id");
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("toCreate skips events whose remote_id is active in another calendar (cross-calendar dedup)", async () => {
    // Simulate: calendar B tries to insert "recurring-instance-001",
    // but that remote_id is already live (not archived) in calendar A.
    mockExistingRows.push({
      id: "owned-by-cal-a",
      remote_id: "recurring-instance-001",
      is_archived: false,
    });

    const { applyPullMutations } = await import("@/lib/sync/orchestrator");

    const mutations: PullMutations = {
      toCreate: [
        {
          title: "Recurring Read only Test",
          start_time: "2026-06-12T05:30:00Z",
          end_time: "2026-06-12T06:00:00Z",
          remote_id: "recurring-instance-001",
          etag: "etag-rec-1",
        },
        {
          title: "Another new event",
          start_time: "2026-06-12T09:00:00Z",
          end_time: "2026-06-12T10:00:00Z",
          remote_id: "one-off-002",
          etag: "etag-2",
        },
      ],
      toUpdate: [],
      toArchive: [],
      toHardDelete: [],
      toAdopt: [],
    };

    const result = await applyPullMutations(mutations, mockCalendar);

    // "recurring-instance-001" should be skipped — still live in another calendar
    expect(capturedInserts).toHaveLength(1);
    expect(capturedInserts[0]).toMatchObject({ remote_id: "one-off-002" });
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("toCreate revives an archived orphan (disconnect → reconnect) instead of skipping it", async () => {
    // Simulate: the calendar was disconnected (events archived, kept) then
    // reconnected under a new external_calendars row. The remote event comes
    // back as a fresh toCreate, but its remote_id still belongs to the archived
    // orphan. It must be revived, not silently dropped.
    mockExistingRows.push({
      id: "orphan-1",
      remote_id: "reconnected-001",
      is_archived: true,
    });

    const { applyPullMutations } = await import("@/lib/sync/orchestrator");

    const mutations: PullMutations = {
      toCreate: [
        {
          title: "Standup",
          start_time: "2026-06-12T05:30:00Z",
          end_time: "2026-06-12T06:00:00Z",
          remote_id: "reconnected-001",
          etag: "etag-reconnect",
        },
      ],
      toUpdate: [],
      toArchive: [],
      toHardDelete: [],
      toAdopt: [],
    };

    const result = await applyPullMutations(mutations, mockCalendar);

    // Not inserted as a new row — the orphan is updated in place.
    expect(capturedInserts).toHaveLength(0);
    expect(capturedUpdates).toContainEqual(
      expect.objectContaining({
        id: "orphan-1",
        data: expect.objectContaining({
          remote_id: "reconnected-001",
          etag: "etag-reconnect",
          is_archived: false,
          remote_calendar_id: "cal-1",
        }),
      }),
    );
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("toUpdate writes etag and clearSyncState=true sets sync_state null", async () => {
    const { applyPullMutations } = await import("@/lib/sync/orchestrator");

    const mutations: PullMutations = {
      toCreate: [],
      toUpdate: [
        {
          id: "local-1",
          data: {
            title: "Updated",
            start_time: "2026-06-01T10:00:00Z",
            end_time: "2026-06-01T11:00:00Z",
          },
          etag: "etag-2",
          clearSyncState: true,
        },
      ],
      toArchive: [],
      toHardDelete: [],
      toAdopt: [],
    };

    const result = await applyPullMutations(mutations, mockCalendar);

    expect(capturedUpdates).toContainEqual(
      expect.objectContaining({
        id: "local-1",
        data: expect.objectContaining({ etag: "etag-2", sync_state: null }),
      }),
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
      expect.objectContaining({
        id: "local-2",
        data: expect.objectContaining({ is_archived: true }),
      }),
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
      expect.objectContaining({
        id: "local-4",
        data: expect.objectContaining({
          remote_id: "remote-new",
          etag: "etag-new",
          sync_state: null,
        }),
      }),
    );
  });
});
