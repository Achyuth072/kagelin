import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import type { ExternalCalendar } from "@/lib/types/external-calendar";

// ── Hoisted mock state ────────────────────────────────────────────────────────

const { pendingEventsRef, capturedUpdates, capturedDeletes, drainTriggerRef } =
  vi.hoisted(() => {
    const pendingEventsRef: { value: CalendarEvent[] } = { value: [] };
    const capturedUpdates: Array<{
      data: Record<string, unknown>;
      id: string;
      snapshotUpdatedAt?: string;
    }> = [];
    const capturedDeletes: string[] = [];
    const drainTriggerRef = { value: false };

    return { pendingEventsRef, capturedUpdates, capturedDeletes, drainTriggerRef };
  });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          not: () =>
            Promise.resolve({ data: pendingEventsRef.value, error: null }),
        }),
      }),
      update: (data: Record<string, unknown>) => ({
        eq: (col: string, val: string) => {
          const captured = { data, id: val };
          return {
            // Second .eq() — drain rule conditional update (includes updated_at)
            eq: (_col2: string, snapshotUpdatedAt: string) => {
              const count = drainTriggerRef.value ? 0 : 1;
              if (!drainTriggerRef.value) {
                capturedUpdates.push({ ...captured, snapshotUpdatedAt });
              }
              return Promise.resolve({ count, error: null });
            },
            // Thenable for unconditional update (only one .eq('id'))
            then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
              capturedUpdates.push(captured);
              return Promise.resolve({ error: null }).then(resolve, reject);
            },
            catch: (reject: (e: unknown) => void) =>
              Promise.resolve({ error: null }).catch(reject),
          };
        },
      }),
      delete: () => ({
        eq: (_col: string, id: string) => {
          capturedDeletes.push(id);
          return Promise.resolve({ error: null });
        },
      }),
    }),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
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

const mockCalendar: Pick<ExternalCalendar, "id" | "user_id" | "sync_direction" | "provider"> = {
  id: "cal-1",
  user_id: "user-1",
  sync_direction: "bidirectional",
  provider: "google",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("pushPendingEvents", () => {
  beforeEach(() => {
    pendingEventsRef.value = [];
    capturedUpdates.length = 0;
    capturedDeletes.length = 0;
    drainTriggerRef.value = false;
  });

  it("pending_create: calls adapter.pushEvent and writes remote_id + etag + sync_state null", async () => {
    const { pushPendingEvents } = await import("@/lib/sync/orchestrator");
    const event = makeEvent({ remote_id: null, etag: null, sync_state: "pending_create" });
    pendingEventsRef.value = [event];

    const mockAdapter = {
      pushEvent: vi.fn().mockResolvedValue({ remoteId: "remote-new", etag: "etag-new" }),
      updateRemoteEvent: vi.fn(),
      deleteRemoteEvent: vi.fn(),
    };

    const result = await pushPendingEvents(mockCalendar as ExternalCalendar, mockAdapter as any);

    expect(mockAdapter.pushEvent).toHaveBeenCalledWith(event);
    expect(capturedUpdates).toContainEqual(
      expect.objectContaining({
        id: event.id,
        data: expect.objectContaining({
          remote_id: "remote-new",
          etag: "etag-new",
          sync_state: null,
        }),
      }),
    );
    expect(result.pushed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("pending_update: calls adapter.updateRemoteEvent and writes updated etag + sync_state null", async () => {
    const { pushPendingEvents } = await import("@/lib/sync/orchestrator");
    const event = makeEvent({ sync_state: "pending_update" });
    pendingEventsRef.value = [event];

    const mockAdapter = {
      pushEvent: vi.fn(),
      updateRemoteEvent: vi.fn().mockResolvedValue({ etag: "etag-updated" }),
      deleteRemoteEvent: vi.fn(),
    };

    const result = await pushPendingEvents(mockCalendar as ExternalCalendar, mockAdapter as any);

    expect(mockAdapter.updateRemoteEvent).toHaveBeenCalledWith(event.remote_id, event);
    expect(capturedUpdates).toContainEqual(
      expect.objectContaining({
        id: event.id,
        data: expect.objectContaining({
          etag: "etag-updated",
          sync_state: null,
        }),
      }),
    );
    expect(result.pushed).toBe(1);
  });

  it("pending_delete: calls adapter.deleteRemoteEvent then hard-deletes the row", async () => {
    const { pushPendingEvents } = await import("@/lib/sync/orchestrator");
    const event = makeEvent({ sync_state: "pending_delete", is_archived: true });
    pendingEventsRef.value = [event];

    const mockAdapter = {
      pushEvent: vi.fn(),
      updateRemoteEvent: vi.fn(),
      deleteRemoteEvent: vi.fn().mockResolvedValue(undefined),
    };

    const result = await pushPendingEvents(mockCalendar as ExternalCalendar, mockAdapter as any);

    expect(mockAdapter.deleteRemoteEvent).toHaveBeenCalledWith(event.remote_id);
    expect(capturedDeletes).toContain(event.id);
    expect(result.pushed).toBe(1);
  });

  it("drain rule: concurrent edit during push keeps sync_state as pending_update", async () => {
    const { pushPendingEvents } = await import("@/lib/sync/orchestrator");
    const event = makeEvent({ sync_state: "pending_update" });
    pendingEventsRef.value = [event];
    drainTriggerRef.value = true; // simulate updated_at advancing during push

    const mockAdapter = {
      pushEvent: vi.fn(),
      updateRemoteEvent: vi.fn().mockResolvedValue({ etag: "etag-v2" }),
      deleteRemoteEvent: vi.fn(),
    };

    await pushPendingEvents(mockCalendar as ExternalCalendar, mockAdapter as any);

    // Fallback unconditional update must set sync_state='pending_update' (not null)
    expect(capturedUpdates).toContainEqual(
      expect.objectContaining({
        id: event.id,
        data: expect.objectContaining({
          sync_state: "pending_update",
          etag: "etag-v2",
        }),
      }),
    );
  });
});
