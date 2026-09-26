import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/../app/api/habits/entry/route";

const mockAuthGetUser = vi.fn();
const mockFrom = vi.fn();

const mockSupabase = {
  auth: { getUser: mockAuthGetUser },
  from: mockFrom,
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

function upsertBuilder(result: { error: null | { message: string } }) {
  const builder = {
    upsert: vi.fn().mockResolvedValue(result),
  };
  return builder;
}

function selectSingleBuilder(result: { data: unknown; error: null }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
  };
  return builder;
}

describe("POST /api/habits/entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user is authenticated", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(
      makeRequest({ habitId: "abc", date: "2026-09-26", state: "done" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when habitId is missing", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(makeRequest({ date: "2026-09-26", state: "done" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when date format is invalid", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(
      makeRequest({ habitId: HABIT_UUID, date: "not-a-date", state: "done" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when state is invalid", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

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
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const habitBuilder = selectSingleBuilder({
      data: { habit_type: "measurable" },
      error: null,
    });
    mockFrom.mockReturnValue(habitBuilder);

    const res = await POST(
      makeRequest({ habitId: HABIT_UUID, date: "2026-09-26", state: "done" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/measurable/i);
  });

  it("upserts value 1 for done on a boolean habit and only sets value (not notes)", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const habitBuilder = selectSingleBuilder({
      data: { habit_type: "boolean" },
      error: null,
    });
    const entryBuilder = upsertBuilder({ error: null });
    mockFrom
      .mockReturnValueOnce(habitBuilder)
      .mockReturnValueOnce(entryBuilder);

    const res = await POST(
      makeRequest({ habitId: HABIT_UUID, date: "2026-09-26", state: "done" }),
    );
    expect(res.status).toBe(200);
    expect(entryBuilder.upsert).toHaveBeenCalledWith(
      { habit_id: HABIT_UUID, date: "2026-09-26", value: 1 },
      { onConflict: "habit_id,date" },
    );
    // notes must not appear in the upsert payload (so existing notes are preserved)
    expect(entryBuilder.upsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ notes: expect.anything() }),
      expect.anything(),
    );
  });

  it("upserts value -2 for skipped (no habit_type check needed)", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const entryBuilder = upsertBuilder({ error: null });
    mockFrom.mockReturnValue(entryBuilder);

    const res = await POST(
      makeRequest({
        habitId: HABIT_UUID,
        date: "2026-09-26",
        state: "skipped",
      }),
    );
    expect(res.status).toBe(200);
    expect(entryBuilder.upsert).toHaveBeenCalledWith(
      { habit_id: HABIT_UUID, date: "2026-09-26", value: -2 },
      { onConflict: "habit_id,date" },
    );
  });
});
