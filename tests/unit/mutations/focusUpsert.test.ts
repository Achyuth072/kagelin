import { describe, it, expect, beforeEach, vi } from "vitest";
import { focusMutations } from "@/lib/mutations/focus";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";

// Hoist mock refs before vi.mock
const { mockUpsert, mockUpdate, mockSelect, mockFrom, mockGetSession } =
  vi.hoisted(() => ({
    mockUpsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockSelect: vi.fn(),
    mockFrom: vi.fn(),
    mockGetSession: vi.fn(),
  }));

// Mock supabase client before any imports resolve
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom.mockReturnValue({
      upsert: mockUpsert,
      // Chainable update().eq().eq().eq().select() for the atomic claim.
      update: mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        select: mockSelect,
      }),
    }),
    auth: {
      getSession: mockGetSession,
    },
  })),
}));

describe("focusMutations.upsertTimerState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should call supabase.from('user_timer_state').upsert() with correct fields and onConflict", async () => {
    // Given: An authenticated user
    localStorage.removeItem("kanso_guest_mode");
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    mockUpsert.mockResolvedValue({ error: null });

    // When: upserting timer state
    await focusMutations.upsertTimerState({
      user_id: "user-1",
      mode: "focus",
      remaining_seconds: 1200,
      is_running: true,
      active_task_id: "task-1",
      ends_at: null,
      source_device_id: "device-1",
      completed_sessions: 0,
      settings: DEFAULT_TIMER_SETTINGS,
      updated_at: expect.any(String),
    });

    // Then: Should call the correct table and upsert with onConflict
    expect(mockFrom).toHaveBeenCalledWith("user_timer_state");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        mode: "focus",
        remaining_seconds: 1200,
        is_running: true,
        active_task_id: "task-1",
      }),
      { onConflict: "user_id" },
    );
  });

  it("should return early (no-op) for guest users", async () => {
    // Given: A guest user (localStorage flag set)
    localStorage.setItem("kanso_guest_mode", "true");

    // When: upserting timer state
    await focusMutations.upsertTimerState({
      user_id: "guest",
      mode: "focus",
      remaining_seconds: 1500,
      is_running: false,
      active_task_id: null,
      ends_at: null,
      source_device_id: "device-1",
      completed_sessions: 0,
      settings: DEFAULT_TIMER_SETTINGS,
    });

    // Then: Should NOT call supabase at all
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("should throw if no authenticated session", async () => {
    // Given: No guest mode, but no auth session either
    localStorage.removeItem("kanso_guest_mode");
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    // When/Then: Should throw
    await expect(
      focusMutations.upsertTimerState({
        user_id: "user-1",
        mode: "focus",
        remaining_seconds: 1500,
        is_running: false,
        active_task_id: null,
        ends_at: null,
        source_device_id: "device-1",
        completed_sessions: 0,
        settings: DEFAULT_TIMER_SETTINGS,
      }),
    ).rejects.toThrow("Not authenticated");
  });
});

describe("focusMutations.claimTimerCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
  });

  const claimInput = {
    user_id: "user-1",
    mode: "shortBreak",
    remaining_seconds: 300,
    is_running: false,
    active_task_id: "task-1",
    ends_at: null,
    source_device_id: "device-1",
    completed_sessions: 1,
    settings: DEFAULT_TIMER_SETTINGS,
    claim_ends_at: "2024-01-01T12:00:00.000Z",
  };

  it("returns true (won) when the conditional update affects a row", async () => {
    mockSelect.mockResolvedValue({ data: [{ id: "row-1" }], error: null });

    const won = await focusMutations.claimTimerCompletion(claimInput);

    expect(won).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns false (lost) when no row matches — another device already completed it", async () => {
    mockSelect.mockResolvedValue({ data: [], error: null });

    const won = await focusMutations.claimTimerCompletion(claimInput);

    expect(won).toBe(false);
  });

  it("returns true for guests without touching the DB", async () => {
    localStorage.setItem("kanso_guest_mode", "true");

    const won = await focusMutations.claimTimerCompletion(claimInput);

    expect(won).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
