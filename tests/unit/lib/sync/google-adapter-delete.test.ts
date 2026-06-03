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

function mockDeleteStatus(status: number) {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
  } as Response);
}

describe("GoogleCalendarAdapter.deleteRemoteEvent — idempotency", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves on 204 (deleted)", async () => {
    const adapter = await makeAdapter();
    mockDeleteStatus(204);
    await expect(adapter.deleteRemoteEvent("evt-1")).resolves.toBeUndefined();
  });

  it("tolerates 404 (already gone)", async () => {
    const adapter = await makeAdapter();
    mockDeleteStatus(404);
    await expect(adapter.deleteRemoteEvent("evt-1")).resolves.toBeUndefined();
  });

  it("tolerates 410 (Gone — already deleted/cancelled)", async () => {
    const adapter = await makeAdapter();
    mockDeleteStatus(410);
    await expect(adapter.deleteRemoteEvent("evt-1")).resolves.toBeUndefined();
  });

  it("still throws on a genuine error (500)", async () => {
    const adapter = await makeAdapter();
    mockDeleteStatus(500);
    await expect(adapter.deleteRemoteEvent("evt-1")).rejects.toThrow(
      "Failed to delete event: 500",
    );
  });
});
