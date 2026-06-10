import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import type { RemoteEvent } from "@/lib/sync/adapter-interface";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "local-evt-1",
    user_id: "user-1",
    title: "All-day Event",
    description: null,
    location: null,
    start_time: "2026-06-06T00:00:00Z",
    end_time: "2026-06-06T23:59:59Z",
    all_day: true,
    color: "#3b82f6",
    category: null,
    recurrence_rule: null,
    remote_id: null,
    remote_calendar_id: "cal-1",
    etag: null,
    ics_uid: null,
    sync_state: "pending_create",
    is_archived: false,
    metadata: {},
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-30T12:00:00Z",
    ...overrides,
  };
}

function makeRemote(data: Record<string, unknown>): RemoteEvent {
  return {
    remoteId: "remote-1",
    etag: "etag-1",
    data,
    updatedAt: new Date("2026-06-01T12:00:00Z"),
  };
}

async function makeAdapter() {
  const { GoogleCalendarAdapter } = await import("@/lib/sync/google-adapter");
  const adapter = new GoogleCalendarAdapter();
  // @ts-expect-error private
  adapter.accessToken = "test-token";
  // @ts-expect-error private
  adapter.externalCalendar = { remote_calendar_id: "primary" };
  return adapter;
}

describe("GoogleCalendarAdapter — all-day exclusive end date", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("inbound: Google exclusive end.date maps to the inclusive last day", async () => {
    const adapter = await makeAdapter();
    // Single-day event June 6 — Google sends exclusive end.date June 7.
    const parsed = adapter.parseRemoteEvent(
      makeRemote({
        summary: "All-day Event",
        start: { date: "2026-06-06" },
        end: { date: "2026-06-07" },
      }),
    );

    expect(parsed?.all_day).toBe(true);
    expect(parsed?.start_time).toBe("2026-06-06T00:00:00Z");
    expect(parsed?.end_time).toBe("2026-06-06T23:59:59Z");
  });

  it("inbound: multi-day event keeps its span (end.date June 9 → last day June 8)", async () => {
    const adapter = await makeAdapter();
    const parsed = adapter.parseRemoteEvent(
      makeRemote({
        summary: "Trip",
        start: { date: "2026-06-06" },
        end: { date: "2026-06-09" },
      }),
    );

    expect(parsed?.start_time).toBe("2026-06-06T00:00:00Z");
    expect(parsed?.end_time).toBe("2026-06-08T23:59:59Z");
  });

  it("outbound: inclusive last day is pushed as Google exclusive end.date", async () => {
    const adapter = await makeAdapter();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "remote-new", etag: "etag-new" }),
    } as Response);

    await adapter.pushEvent(makeEvent());

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentBody = JSON.parse(init.body as string);

    expect(sentBody.start).toEqual({ date: "2026-06-06" });
    expect(sentBody.end).toEqual({ date: "2026-06-07" });
  });

  it("round-trips a single-day all-day event without drift", async () => {
    const adapter = await makeAdapter();
    const parsed = adapter.parseRemoteEvent(
      makeRemote({
        summary: "All-day Event",
        start: { date: "2026-06-06" },
        end: { date: "2026-06-07" },
      }),
    );

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "remote-new", etag: "etag-new" }),
    } as Response);

    await adapter.pushEvent(
      makeEvent({
        start_time: parsed!.start_time,
        end_time: parsed!.end_time,
        all_day: parsed!.all_day,
      }),
    );

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.start).toEqual({ date: "2026-06-06" });
    expect(sentBody.end).toEqual({ date: "2026-06-07" });
  });
});
