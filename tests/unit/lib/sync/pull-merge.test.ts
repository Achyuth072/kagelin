import { describe, it, expect } from "vitest";
import {
  computePullMutations,
  type IncomingRemoteEvent,
} from "@/lib/sync/pull-merge";
import type { CalendarEvent } from "@/lib/types/calendar-event";

function makeLocal(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "local-1",
    user_id: "user-1",
    title: "Meeting",
    description: null,
    location: null,
    start_time: "2026-06-01T10:00:00Z",
    end_time: "2026-06-01T11:00:00Z",
    all_day: false,
    color: "#3b82f6",
    category: null,
    recurrence_rule: null,
    remote_id: "remote-1",
    remote_calendar_id: "cal-1",
    etag: "etag-1",
    ics_uid: null,
    sync_state: null,
    is_archived: false,
    metadata: {},
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-30T12:00:00Z",
    ...overrides,
  };
}

function makeRemote(
  overrides: Partial<IncomingRemoteEvent> = {},
): IncomingRemoteEvent {
  return {
    remoteId: "remote-1",
    etag: "etag-1",
    updatedAt: new Date("2026-05-30T12:00:00Z"),
    parsed: {
      title: "Meeting",
      start_time: "2026-06-01T10:00:00Z",
      end_time: "2026-06-01T11:00:00Z",
    },
    ...overrides,
  };
}

describe("computePullMutations", () => {
  it("new remote event → toCreate with remote_id and etag", () => {
    const result = computePullMutations(
      [],
      [
        makeRemote({
          remoteId: "remote-new",
          etag: "etag-new",
          parsed: {
            title: "New",
            start_time: "2026-06-01T10:00:00Z",
            end_time: "2026-06-01T11:00:00Z",
          },
        }),
      ],
      [],
    );

    expect(result.toCreate).toHaveLength(1);
    expect(result.toCreate[0]).toMatchObject({
      remote_id: "remote-new",
      etag: "etag-new",
      title: "New",
    });
    expect(result.toUpdate).toHaveLength(0);
    expect(result.toAdopt).toHaveLength(0);
  });

  it("remote event with unchanged etag → no-op", () => {
    const local = makeLocal({ etag: "etag-1" });
    const result = computePullMutations(
      [local],
      [makeRemote({ etag: "etag-1" })],
      [],
    );

    expect(result.toCreate).toHaveLength(0);
    expect(result.toUpdate).toHaveLength(0);
  });

  it("etag changed, sync_state null → remote update applied", () => {
    const local = makeLocal({
      sync_state: null,
      updated_at: "2026-05-30T11:00:00Z",
    });
    const result = computePullMutations(
      [local],
      [
        makeRemote({
          etag: "etag-2",
          updatedAt: new Date("2026-05-30T12:00:00Z"),
          parsed: {
            title: "Updated",
            start_time: "2026-06-01T10:00:00Z",
            end_time: "2026-06-01T11:00:00Z",
          },
        }),
      ],
      [],
    );

    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0]).toMatchObject({
      id: "local-1",
      etag: "etag-2",
      clearSyncState: true,
    });
    expect(result.toUpdate[0].data).toMatchObject({ title: "Updated" });
  });

  it("etag changed, pending_update, local newer → local wins (skip remote update)", () => {
    const local = makeLocal({
      sync_state: "pending_update",
      updated_at: "2026-05-30T13:00:00Z",
    });
    const result = computePullMutations(
      [local],
      [
        makeRemote({
          etag: "etag-2",
          updatedAt: new Date("2026-05-30T12:00:00Z"),
        }),
      ],
      [],
    );

    expect(result.toUpdate).toHaveLength(0);
  });

  it("etag changed, pending_update, remote newer → remote wins and clears sync_state", () => {
    const local = makeLocal({
      sync_state: "pending_update",
      updated_at: "2026-05-30T11:00:00Z",
    });
    const result = computePullMutations(
      [local],
      [
        makeRemote({
          etag: "etag-2",
          updatedAt: new Date("2026-05-30T12:00:00Z"),
        }),
      ],
      [],
    );

    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0]).toMatchObject({
      id: "local-1",
      etag: "etag-2",
      clearSyncState: true,
    });
  });

  it("etag changed, pending_delete + remote edit → local delete preserved (no resurrection)", () => {
    const local = makeLocal({
      sync_state: "pending_delete",
      updated_at: "2026-05-30T11:00:00Z",
    });
    const result = computePullMutations(
      [local],
      [
        makeRemote({
          etag: "etag-2",
          updatedAt: new Date("2026-05-30T12:00:00Z"),
          parsed: {
            title: "Edited remotely",
            start_time: "2026-06-01T10:00:00Z",
            end_time: "2026-06-01T11:00:00Z",
          },
        }),
      ],
      [],
    );

    expect(result.toUpdate).toHaveLength(0);
  });

  it("kansoId matches pending_create → adopt remote_id and etag, no duplicate create", () => {
    const local = makeLocal({
      id: "local-1",
      remote_id: null,
      etag: null,
      sync_state: "pending_create",
    });
    const result = computePullMutations(
      [local],
      [
        makeRemote({
          remoteId: "remote-new",
          etag: "etag-new",
          kansoId: "local-1",
        }),
      ],
      [],
    );

    expect(result.toCreate).toHaveLength(0);
    expect(result.toAdopt).toHaveLength(1);
    expect(result.toAdopt[0]).toEqual({
      id: "local-1",
      remote_id: "remote-new",
      etag: "etag-new",
    });
  });

  it("remote deletion of clean event → tombstone (toArchive)", () => {
    const local = makeLocal({ sync_state: null });
    const result = computePullMutations([local], [], ["remote-1"]);

    expect(result.toArchive).toContain("local-1");
    expect(result.toHardDelete).toHaveLength(0);
  });

  it("remote deletion of pending_create event → hard-delete", () => {
    const local = makeLocal({
      sync_state: "pending_create",
      remote_id: "remote-1",
    });
    const result = computePullMutations([local], [], ["remote-1"]);

    expect(result.toHardDelete).toContain("local-1");
    expect(result.toArchive).toHaveLength(0);
  });
});
