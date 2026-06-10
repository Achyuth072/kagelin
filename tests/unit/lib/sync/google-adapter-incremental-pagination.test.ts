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

describe("GoogleCalendarAdapter.incrementalSync — pagination", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("follows nextPageToken across pages and returns the final nextSyncToken", async () => {
    // Page 1: 250 cancelled instances + nextPageToken, NO nextSyncToken (more pages)
    // Page 2: the genuinely new event + final nextSyncToken
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: Array.from({ length: 250 }, (_, i) => ({
            id: `cancelled-${i}`,
            status: "cancelled",
          })),
          nextPageToken: "PAGE2",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: "new-evt",
              etag: "etag-new",
              status: "confirmed",
              summary: "Fresh event",
              start: { dateTime: "2026-06-10T09:00:00Z" },
              end: { dateTime: "2026-06-10T10:00:00Z" },
            },
          ],
          nextSyncToken: "FINAL_TOKEN",
        }),
      } as Response);

    const adapter = await makeAdapter();
    const delta = await adapter.incrementalSync("OLD_TOKEN");

    // Both pages fetched
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Second request carries the page token
    expect(String(fetchMock.mock.calls[1][0])).toContain("pageToken=PAGE2");
    // Accumulated across pages
    expect(delta.deleted).toHaveLength(250);
    expect(delta.updated).toHaveLength(1);
    expect(delta.updated[0].remoteId).toBe("new-evt");
    // Token advanced to the final page's nextSyncToken (not the stale input)
    expect(delta.newSyncToken).toBe("FINAL_TOKEN");
  });
});
