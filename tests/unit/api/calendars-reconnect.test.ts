import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/../app/api/calendar/calendars/route";

const mockAuthGetUser = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({ auth: { getUser: mockAuthGetUser } }),
  ),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/calendar/calendars", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Builds a fluent builder that is thenable (awaitable), returning `result`. */
function makeThenableChain<T>(result: T) {
  const b: Record<string, unknown> = {};
  const self = () => b;
  for (const m of ["select", "eq", "not", "insert", "update", "delete", "in"]) {
    b[m] = vi.fn(self);
  }
  b["then"] = (
    onFulfilled?: ((v: T) => unknown) | null,
    onRejected?: ((r: unknown) => unknown) | null,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return b as typeof b & { [k: string]: ReturnType<typeof vi.fn> };
}

describe("POST /api/calendar/calendars – orphan adoption on reconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
  });

  it("adopts archived orphaned events to the new calendar and unarchives them", async () => {
    // Chain 1: existing check → no duplicates
    const existingCheck = makeThenableChain({ data: [], error: null });

    // Chain 2: insert new row → returns new calendar id
    const afterInsert = {
      select: vi.fn().mockResolvedValue({
        data: [{ id: "new-cal-1" }],
        error: null,
      }),
    };
    const insertChain = { insert: vi.fn(() => afterInsert) };

    // Chain 3: all active external_calendar IDs → ["new-cal-1"]
    const activeIds = makeThenableChain({
      data: [{ id: "new-cal-1" }],
      error: null,
    });

    // Chain 4: archived synced events → two orphans (reference old deleted UUIDs)
    const archivedEvents = makeThenableChain({
      data: [
        { id: "evt-1", remote_calendar_id: "old-cal-dead-1" },
        { id: "evt-2", remote_calendar_id: "old-cal-dead-2" },
      ],
      error: null,
    });

    // Chain 5: update (adoption) — capture what gets written
    const capturedUpdateData: unknown[] = [];
    const capturedUpdateIds: string[][] = [];
    const updateChain = {
      update: vi.fn((d: unknown) => {
        capturedUpdateData.push(d);
        return {
          in: vi.fn((_col: string, ids: string[]) => {
            capturedUpdateIds.push(ids);
            return Promise.resolve({ error: null });
          }),
        };
      }),
    };

    mockAdminFrom
      .mockReturnValueOnce(existingCheck) // existing-calendar dedup check
      .mockReturnValueOnce(insertChain) // insert new external_calendars row
      .mockReturnValueOnce(activeIds) // all active calendar IDs
      .mockReturnValueOnce(archivedEvents) // archived synced events query
      .mockReturnValueOnce(updateChain); // adoption update

    const response = await POST(
      makeRequest({
        provider: "google",
        calendars: [{ remote_calendar_id: "primary", name: "My Calendar" }],
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.created).toBe(1);

    expect(capturedUpdateData[0]).toEqual({
      remote_calendar_id: "new-cal-1",
      is_archived: false,
    });
    expect(capturedUpdateIds[0]).toEqual(["evt-1", "evt-2"]);
  });

  it("skips adoption when all archived events reference active calendars", async () => {
    const existingCheck = makeThenableChain({ data: [], error: null });

    const afterInsert = {
      select: vi.fn().mockResolvedValue({
        data: [{ id: "new-cal-2" }],
        error: null,
      }),
    };
    const insertChain = { insert: vi.fn(() => afterInsert) };

    const activeIds = makeThenableChain({
      data: [{ id: "new-cal-2" }, { id: "other-active" }],
      error: null,
    });

    // Both archived events reference currently-active calendars → no orphans
    const archivedEvents = makeThenableChain({
      data: [
        { id: "evt-3", remote_calendar_id: "new-cal-2" },
        { id: "evt-4", remote_calendar_id: "other-active" },
      ],
      error: null,
    });

    const updateMock = vi.fn();

    mockAdminFrom
      .mockReturnValueOnce(existingCheck)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(activeIds)
      .mockReturnValueOnce(archivedEvents);

    const response = await POST(
      makeRequest({
        provider: "google",
        calendars: [{ remote_calendar_id: "primary", name: "Cal" }],
      }),
    );

    expect(response.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
    // No 5th mockAdminFrom call means update was never reached
    expect(mockAdminFrom).toHaveBeenCalledTimes(4);
  });

  it("returns 400 when provider or calendars are missing", async () => {
    const response = await POST(
      makeRequest({ provider: "google", calendars: [] }),
    );
    expect(response.status).toBe(400);
  });

  it("returns created: 0 when all picks already exist (no insertion)", async () => {
    const existingCheck = makeThenableChain({
      data: [{ remote_calendar_id: "primary" }],
      error: null,
    });

    mockAdminFrom.mockReturnValueOnce(existingCheck);

    const response = await POST(
      makeRequest({
        provider: "google",
        calendars: [{ remote_calendar_id: "primary", name: "Cal" }],
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.created).toBe(0);
    // Only one admin.from call (the existing-check); no insert, no adoption
    expect(mockAdminFrom).toHaveBeenCalledTimes(1);
  });
});
