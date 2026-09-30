import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/../app/api/habits/entry/route";

const mockGetClaims = vi.fn();
const mockRpc = vi.fn();
const mockGetUser = vi.fn();

const mockSupabase = {
  auth: { getClaims: mockGetClaims, getUser: mockGetUser },
  rpc: mockRpc,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

const HABIT_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/habits/entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function signedIn() {
  mockGetClaims.mockResolvedValue({
    data: { claims: { sub: "user-1" } },
    error: null,
  });
}

describe("POST /api/habits/entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user is authenticated", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null });

    const res = await POST(
      makeRequest({ habitId: "abc", date: "2026-09-26", state: "done" }),
    );
    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 when habitId is missing", async () => {
    signedIn();

    const res = await POST(makeRequest({ date: "2026-09-26", state: "done" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when date format is invalid", async () => {
    signedIn();

    const res = await POST(
      makeRequest({ habitId: HABIT_UUID, date: "not-a-date", state: "done" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when date is not a real calendar day", async () => {
    signedIn();

    const res = await POST(
      makeRequest({
        habitId: HABIT_UUID,
        date: "2026-02-30",
        state: "skipped",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when state is invalid", async () => {
    signedIn();

    const res = await POST(
      makeRequest({
        habitId: HABIT_UUID,
        date: "2026-09-26",
        state: "not_done",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when done is sent for a measurable habit", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "measurable", error: null });

    const res = await POST(
      makeRequest({ habitId: HABIT_UUID, date: "2026-09-26", state: "done" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/measurable/i);
  });

  it("returns 400 when the habit does not exist for this user", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "not_found", error: null });

    const res = await POST(
      makeRequest({
        habitId: HABIT_UUID,
        date: "2026-09-26",
        state: "skipped",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when the write fails", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(
      makeRequest({ habitId: HABIT_UUID, date: "2026-09-26", state: "done" }),
    );
    expect(res.status).toBe(500);
  });

  it("records the requested state through one RPC on the payload's date", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "ok", error: null });

    const res = await POST(
      makeRequest({ habitId: HABIT_UUID, date: "2026-09-26", state: "done" }),
    );
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("record_habit_entry", {
      p_habit_id: HABIT_UUID,
      p_date: "2026-09-26",
      p_state: "done",
    });
  });

  it("does not ask the Auth server who the user is", async () => {
    signedIn();
    mockRpc.mockResolvedValue({ data: "ok", error: null });

    await POST(
      makeRequest({
        habitId: HABIT_UUID,
        date: "2026-09-26",
        state: "skipped",
      }),
    );
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
