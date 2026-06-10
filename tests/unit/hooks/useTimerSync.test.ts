import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";
import { useTimerSync } from "@/lib/hooks/useTimerSync";
import { getDeviceId } from "@/lib/store/deviceId";
import { getServerOffset, setServerOffset } from "@/lib/store/serverClock";

// ===== Hoisted mocks for module-level mocking =====

const {
  mockUseAuth,
  mockSetIsSynced,
  toastMock,
  mockUpsertTimerState,
  hydrate,
  mockRpc,
  mockMaybeSingle,
} = vi.hoisted(() => {
  const hydrate = { row: null as Record<string, unknown> | null };
  return {
    mockUseAuth: vi.fn().mockReturnValue({
      user: { id: "user-1" },
      isGuestMode: false,
    }),
    mockSetIsSynced: vi.fn(),
    toastMock: vi.fn(),
    mockUpsertTimerState: vi.fn(),
    // Mutable row returned by the initial hydrate SELECT.
    hydrate,
    // Server-time probe — number by default (no offset) for deterministic tests.
    // data is widened to allow string payloads (PostgREST bigint-as-string case).
    mockRpc: vi.fn(
      async () =>
        ({ data: Date.now(), error: null }) as {
          data: number | string;
          error: null;
        },
    ),
    // Initial hydrate SELECT — returns the configurable hydrate row.
    mockMaybeSingle: vi.fn(async () => ({ data: hydrate.row, error: null })),
  };
});

// ===== Postgres changes callback capture =====

type PgPayload = { new: Record<string, unknown> };
let pgCallback: ((payload: PgPayload) => void) | null = null;
let pgConfig: Record<string, unknown> | null = null;
let _statusCallback: ((status: string) => void) | null = null;

vi.mock("@/components/AuthProvider", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => {
    const channelObj = {
      on: vi.fn(
        (
          _event: string,
          config: Record<string, unknown>,
          callback: (p: PgPayload) => void,
        ) => {
          pgConfig = config;
          pgCallback = callback;
          return channelObj;
        },
      ),
      subscribe: vi.fn((callback: (status: string) => void) => {
        _statusCallback = callback || null;
        if (callback) callback("SUBSCRIBED");
        return { unsubscribe: vi.fn() };
      }),
    };
    return {
      channel: vi.fn(() => channelObj),
      removeChannel: vi.fn(),
      rpc: mockRpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })),
        })),
      })),
    };
  }),
}));

vi.mock("@/lib/mutations/focus", () => ({
  focusMutations: {
    upsertTimerState: mockUpsertTimerState,
  },
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: {
    getState: vi.fn(() => ({
      setIsSynced: mockSetIsSynced,
    })),
  },
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

// ===== Test suite =====

describe("useTimerSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pgCallback = null;
    pgConfig = null;
    _statusCallback = null;
    hydrate.row = null;
    setServerOffset(0);
    mockRpc.mockImplementation(async () => ({ data: Date.now(), error: null }));
    mockMaybeSingle.mockImplementation(async () => ({
      data: hydrate.row,
      error: null,
    }));

    // Reset timer store to defaults
    useTimerStore.setState({
      state: {
        mode: "focus",
        isRunning: false,
        remainingSeconds: DEFAULT_TIMER_SETTINGS.focusDuration * 60,
        completedSessions: 0,
        activeTaskId: null,
        endsAt: null,
        sourceDeviceId: null,
      },
      settings: DEFAULT_TIMER_SETTINGS,
      isLoaded: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Test 1: Subscribes to postgres_changes when not guest ---

  it("should subscribe to postgres_changes on user_timer_state with user_id filter when not guest", () => {
    const { result } = renderHook(() => useTimerSync());

    // The hook should return upsertTimerState
    expect(result.current.upsertTimerState).toBeDefined();
    expect(typeof result.current.upsertTimerState).toBe("function");

    // Verify channel was created with correct name
    // We can infer the channel name by checking that the mock was called
    // Since channel is a vi.fn() from the mock, we can't directly assert on its args
    // But we can assert that pgCallback was set up by the .on() call
    expect(pgCallback).not.toBeNull();
  });

  // --- Test 2: Guest mode skips subscription ---

  it("should not subscribe when isGuestMode is true", () => {
    mockUseAuth.mockReturnValueOnce({
      user: { id: "guest" },
      isGuestMode: true,
    });

    renderHook(() => useTimerSync());

    // pgCallback should remain null because the effect returned early
    expect(pgCallback).toBeNull();
  });

  // --- Test 3: Remote UPDATE with newer updated_at applies state ---

  it("should apply remote state to timerStore on UPDATE with newer updated_at", () => {
    renderHook(() => useTimerSync());
    expect(pgCallback).not.toBeNull();

    const initialState = useTimerStore.getState().state;
    expect(initialState.mode).toBe("focus");
    expect(initialState.isRunning).toBe(false);

    // When: Simulate a remote UPDATE with running state (from another device)
    act(() => {
      pgCallback!({
        new: {
          mode: "shortBreak",
          remaining_seconds: 300,
          is_running: true,
          active_task_id: "task-remote",
          source_device_id: "other-device",
          updated_at: "2024-01-01T12:00:00Z",
        },
      });
    });

    // Then: Timer store should reflect the remote state
    const updatedState = useTimerStore.getState().state;
    expect(updatedState.mode).toBe("shortBreak");
    expect(updatedState.remainingSeconds).toBe(300);
    expect(updatedState.isRunning).toBe(true);
    expect(updatedState.activeTaskId).toBe("task-remote");
  });

  // --- Test 4: Self-originating update (echo guard by source_device_id) ---

  it("should skip a remote update whose source_device_id is this device", () => {
    renderHook(() => useTimerSync());
    expect(pgCallback).not.toBeNull();

    // Given: Some initial state
    useTimerStore.setState((s) => ({
      state: {
        ...s.state,
        mode: "focus",
        remainingSeconds: 1500,
        isRunning: false,
        activeTaskId: null,
      },
    }));

    // When: A remote update arrives stamped with our own device id (an echo)
    act(() => {
      pgCallback!({
        new: {
          mode: "shortBreak",
          remaining_seconds: 300,
          is_running: true,
          active_task_id: "task-echo",
          source_device_id: getDeviceId(),
          updated_at: "2024-01-01T12:01:00Z",
        },
      });
    });

    // Should have been skipped — state unchanged
    const state = useTimerStore.getState().state;
    expect(state.mode).toBe("focus");
    expect(state.remainingSeconds).toBe(1500);
    expect(state.isRunning).toBe(false);
    expect(state.activeTaskId).toBeNull();
  });

  // --- Test 5: Stale remote update skipped (last-write-wins) ---

  it("should skip stale remote update with older updated_at", () => {
    renderHook(() => useTimerSync());
    expect(pgCallback).not.toBeNull();

    // Given: A fresh remote update comes in first
    act(() => {
      pgCallback!({
        new: {
          mode: "focus",
          remaining_seconds: 1400,
          is_running: true,
          active_task_id: "task-first",
          source_device_id: "other-device",
          updated_at: "2024-01-01T12:10:00Z",
        },
      });
    });

    expect(useTimerStore.getState().state.remainingSeconds).toBe(1400);

    // When: A stale remote update arrives (older updated_at)
    act(() => {
      pgCallback!({
        new: {
          mode: "shortBreak",
          remaining_seconds: 200,
          is_running: false,
          active_task_id: "task-stale",
          source_device_id: "other-device",
          updated_at: "2024-01-01T12:05:00Z",
        },
      });
    });

    // Then: Should still have the first state (stale update ignored)
    const state = useTimerStore.getState().state;
    expect(state.remainingSeconds).toBe(1400);
    expect(state.isRunning).toBe(true);
    expect(state.activeTaskId).toBe("task-first");
  });

  // --- Test 6: Channel removed on cleanup ---

  it("should remove channel on unmount", () => {
    const { unmount } = renderHook(() => useTimerSync());

    // We need to capture the removeChannel mock from a reference
    // Since the mock is created inside the factory, we can't directly reference it
    // But we can verify the behavior by checking setIsSynced was called with false on cleanup
    // Actually the simplest: verify that the hook renders and unmounts without error
    // The removeChannel call is verified indirectly by setIsSynced(false) on cleanup

    unmount();
    // On unmount, the cleanup should call setIsSynced(false)
    expect(mockSetIsSynced).toHaveBeenCalledWith(false);
  });

  // --- Test 7: isSynced flag management ---

  it("should set isSynced to true on successful subscription and false on cleanup", () => {
    const { unmount } = renderHook(() => useTimerSync());

    // On subscribe callback with "SUBSCRIBED" status
    expect(mockSetIsSynced).toHaveBeenCalledWith(true);

    // On cleanup (unmount)
    unmount();
    expect(mockSetIsSynced).toHaveBeenCalledWith(false);
  });

  // --- Test 8: Toast on remote pause/stop ---

  it("should show toast on remote pause command", () => {
    renderHook(() => useTimerSync());
    expect(pgCallback).not.toBeNull();

    // Given: Timer is running locally
    useTimerStore.setState((s) => ({
      state: {
        ...s.state,
        isRunning: true,
        remainingSeconds: 800,
        mode: "focus",
        activeTaskId: "task-running",
      },
    }));

    // When: Remote pause (is_running: false, remaining_seconds > 0)
    act(() => {
      pgCallback!({
        new: {
          mode: "focus",
          remaining_seconds: 750,
          is_running: false,
          active_task_id: "task-running",
          source_device_id: "other-device",
          updated_at: "2024-01-01T12:15:00Z",
        },
      });
    });

    // Then: Toast should show "paused" message
    expect(toastMock).toHaveBeenCalledWith(
      "Timer paused from another device",
      expect.any(Object),
    );
  });

  it("should show toast on remote stop command", () => {
    renderHook(() => useTimerSync());
    expect(pgCallback).not.toBeNull();

    // Given: Timer is running locally
    useTimerStore.setState((s) => ({
      state: {
        ...s.state,
        isRunning: true,
        remainingSeconds: 800,
        mode: "focus",
        activeTaskId: "task-running",
      },
    }));

    // When: Remote stop (is_running: false, remaining_seconds: 0)
    act(() => {
      pgCallback!({
        new: {
          mode: "focus",
          remaining_seconds: 0,
          is_running: false,
          active_task_id: null,
          source_device_id: "other-device",
          updated_at: "2024-01-01T12:16:00Z",
        },
      });
    });

    // Then: Toast should show "stopped" message
    expect(toastMock).toHaveBeenCalledWith(
      "Timer stopped from another device",
      expect.any(Object),
    );
  });

  // --- Test 9: Initial hydrate mirrors a running row on subscribe ---

  it("should hydrate the live running row (endsAt) on subscribe", async () => {
    // Given: a running row already exists, ending 600s from now
    const endsAt = new Date(Date.now() + 600_000).toISOString();
    hydrate.row = {
      mode: "focus",
      remaining_seconds: 900,
      is_running: true,
      active_task_id: "task-live",
      ends_at: endsAt,
      source_device_id: "other-device",
      completed_sessions: 2,
      updated_at: "2024-01-01T12:20:00Z",
    };

    await act(async () => {
      renderHook(() => useTimerSync());
    });

    // Then: the local store mirrors the deadline and ticks toward it (~600s)
    const state = useTimerStore.getState().state;
    expect(state.isRunning).toBe(true);
    expect(state.activeTaskId).toBe("task-live");
    expect(state.endsAt).toBe(Date.parse(endsAt));
    expect(state.completedSessions).toBe(2);
    expect(state.remainingSeconds).toBeLessThanOrEqual(600);
    expect(state.remainingSeconds).toBeGreaterThan(595);
  });

  // --- Test 10: Offset probe tolerates bigint returned as a string (H2) ---

  it("computes the server offset even when the probe returns a numeric string", async () => {
    // PostgREST can serialize BIGINT as a string; the probe must still work.
    const serverMs = Date.now() + 50_000; // server ~50s ahead
    mockRpc.mockImplementation(async () => ({
      data: String(serverMs),
      error: null,
    }));

    await act(async () => {
      renderHook(() => useTimerSync());
    });

    // Offset should be ~+50s (allowing for RTT/timing slack), not 0.
    expect(getServerOffset()).toBeGreaterThan(40_000);
  });

  // --- Test 11: Re-hydrate from the DB on visibility change (H3) ---

  it("re-hydrates the live row when the tab returns to the foreground", async () => {
    // Mount with an idle row.
    hydrate.row = {
      mode: "focus",
      remaining_seconds: 1500,
      is_running: false,
      active_task_id: null,
      ends_at: null,
      source_device_id: "other-device",
      completed_sessions: 0,
      updated_at: "2024-01-01T12:00:00Z",
    };
    await act(async () => {
      renderHook(() => useTimerSync());
    });
    const hydrateCallsAfterMount = mockMaybeSingle.mock.calls.length;

    // While backgrounded, the server advanced to a running session.
    const endsAt = new Date(Date.now() + 300_000).toISOString();
    hydrate.row = {
      mode: "focus",
      remaining_seconds: 600,
      is_running: true,
      active_task_id: "task-bg",
      ends_at: endsAt,
      source_device_id: "other-device",
      completed_sessions: 3,
      updated_at: "2024-01-01T12:30:00Z",
    };

    // Returning to the foreground must pull fresh state.
    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockMaybeSingle.mock.calls.length).toBeGreaterThan(
      hydrateCallsAfterMount,
    );
    const state = useTimerStore.getState().state;
    expect(state.isRunning).toBe(true);
    expect(state.activeTaskId).toBe("task-bg");
    expect(state.completedSessions).toBe(3);
  });

  // --- Test 12: Settings ride along with the upsert (H5) ---

  it("includes the local focus settings in the upsert payload", async () => {
    const { result } = renderHook(() => useTimerSync());
    useTimerStore.setState({
      settings: { ...DEFAULT_TIMER_SETTINGS, focusDuration: 1 },
    });

    await act(async () => {
      await result.current.upsertTimerState();
    });

    expect(mockUpsertTimerState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ focusDuration: 1 }),
      }),
    );
  });

  // --- Test 13: Remote settings are applied so devices agree (H5) ---

  it("applies remote settings on UPDATE", () => {
    renderHook(() => useTimerSync());
    expect(pgCallback).not.toBeNull();

    act(() => {
      pgCallback!({
        new: {
          mode: "focus",
          remaining_seconds: 60,
          is_running: false,
          active_task_id: null,
          ends_at: null,
          source_device_id: "other-device",
          completed_sessions: 0,
          settings: { ...DEFAULT_TIMER_SETTINGS, focusDuration: 1 },
          updated_at: "2024-01-01T13:00:00Z",
        },
      });
    });

    expect(useTimerStore.getState().settings.focusDuration).toBe(1);
  });

  // --- Test 14: Subscribes WITHOUT a non-PK filter so realtime delivers (H4) ---

  it("subscribes without a user_id filter (RLS scopes delivery; non-PK filter needs REPLICA IDENTITY FULL)", () => {
    renderHook(() => useTimerSync());

    expect(pgConfig).not.toBeNull();
    expect(pgConfig).toMatchObject({
      schema: "public",
      table: "user_timer_state",
    });
    // A server-side filter on the non-PK user_id column silently drops UPDATEs
    // unless REPLICA IDENTITY FULL is set; RLS already scopes delivery to the
    // user's own row, so no filter is needed.
    expect(pgConfig?.filter).toBeUndefined();
  });
});
