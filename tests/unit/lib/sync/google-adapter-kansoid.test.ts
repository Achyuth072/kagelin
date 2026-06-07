import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CalendarEvent } from "@/lib/types/calendar-event";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "local-evt-1",
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

async function makeAdapter() {
  const { GoogleCalendarAdapter } = await import("@/lib/sync/google-adapter");
  const adapter = new GoogleCalendarAdapter();
  // @ts-expect-error private
  adapter.accessToken = "test-token";
  // @ts-expect-error private
  adapter.externalCalendar = { remote_calendar_id: "primary" };
  return adapter;
}

describe("GoogleCalendarAdapter — kansoId stamping", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("pushEvent sends extendedProperties.private.kansoId = event.id", async () => {
    const adapter = await makeAdapter();
    const event = makeEvent();

    let sentBody: Record<string, unknown> = {};
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "remote-new", etag: "etag-new" }),
    } as Response);

    await adapter.pushEvent(event);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    sentBody = JSON.parse(init.body as string);

    expect(sentBody).toMatchObject({
      extendedProperties: { private: { kansoId: "local-evt-1" } },
    });
  });

  it("fullSync extracts kansoId from extendedProperties into RemoteEvent.kansoId", async () => {
    const adapter = await makeAdapter();

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "remote-1",
            etag: "etag-1",
            updated: "2026-06-01T12:00:00Z",
            summary: "Meeting",
            start: { dateTime: "2026-06-01T10:00:00Z" },
            end: { dateTime: "2026-06-01T11:00:00Z" },
            extendedProperties: { private: { kansoId: "local-evt-1" } },
          },
        ],
        nextSyncToken: "token-abc",
      }),
    } as Response);

    const { events } = await adapter.fullSync();

    expect(events).toHaveLength(1);
    expect(events[0].kansoId).toBe("local-evt-1");
  });
});
