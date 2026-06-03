import { describe, it, expect, vi, beforeEach } from "vitest";

async function makeAdapter() {
  const { GoogleCalendarAdapter } = await import("@/lib/sync/google-adapter");
  const adapter = new GoogleCalendarAdapter();
  // @ts-expect-error private
  adapter.accessToken = "test-token";
  // @ts-expect-error private
  adapter.externalCalendar = { remote_calendar_id: "primary" };
  return adapter;
}

describe("GoogleCalendarAdapter — recurring expansion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("incrementalSync requests expanded instances (singleEvents=true) to match the full-sync token", async () => {
    const adapter = await makeAdapter();

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], nextSyncToken: "token-next" }),
    } as Response);

    await adapter.incrementalSync("token-prev");

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("singleEvents=true");
  });

  it("parseRemoteEvent records the recurring series id so the UI can gate edits", async () => {
    const adapter = await makeAdapter();

    const parsed = adapter.parseRemoteEvent({
      remoteId: "abc_20260610T090000Z",
      etag: "etag-1",
      data: {
        id: "abc_20260610T090000Z",
        recurringEventId: "abc",
        summary: "Weekly standup",
        start: { dateTime: "2026-06-10T09:00:00Z" },
        end: { dateTime: "2026-06-10T09:30:00Z" },
      },
    });

    expect(parsed?.metadata?.recurring_series_id).toBe("abc");
  });
});
