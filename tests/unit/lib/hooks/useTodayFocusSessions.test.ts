import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTodayFocusSessions } from "@/lib/hooks/useTodayFocusSessions";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => Promise.resolve({ count: 3, error: null })),
      })),
    })),
  })),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: false })),
}));

vi.mock("@/lib/mock/mock-store", () => ({
  mockStore: {
    getFocusLogs: vi.fn(),
  },
}));

vi.mock("@/lib/hooks/useCurrentTime", () => ({
  useCurrentTime: vi.fn(() => new Date("2026-11-23T10:00:00.000Z")),
}));

describe("useTodayFocusSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes the current date in the queryKey", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: 2,
      isLoading: false,
    } as ReturnType<typeof useQuery>);

    renderHook(() => useTodayFocusSessions());

    expect(useQuery).toHaveBeenCalledTimes(1);
    const queryOptions = vi.mocked(useQuery).mock.calls[0]?.[0];
    expect(queryOptions?.queryKey).toEqual([
      "today-focus-count",
      false,
      "2026-11-23",
    ]);
  });

  it("filters guest logs by today's start date", async () => {
    vi.mocked(useAuth).mockReturnValue({ isGuestMode: true } as ReturnType<
      typeof useAuth
    >);
    vi.mocked(mockStore.getFocusLogs).mockReturnValue([
      {
        id: "1",
        user_id: "user-1",
        task_id: null,
        start_time: "2026-11-23T08:00:00.000Z",
        end_time: "2026-11-23T08:25:00.000Z",
        duration_seconds: 1500,
        created_at: "2026-11-23T08:25:00.000Z",
      },
      {
        id: "2",
        user_id: "user-1",
        task_id: null,
        start_time: "2026-11-22T23:50:00.000Z",
        end_time: "2026-11-23T00:15:00.000Z",
        duration_seconds: 1500,
        created_at: "2026-11-23T00:15:00.000Z",
      },
    ]);

    let capturedQueryFn: (() => Promise<number>) | undefined;
    vi.mocked(useQuery).mockImplementation((opts) => {
      capturedQueryFn = opts.queryFn as () => Promise<number>;
      return { data: 0 } as ReturnType<typeof useQuery>;
    });

    renderHook(() => useTodayFocusSessions());

    expect(capturedQueryFn).toBeDefined();
    const count = await capturedQueryFn!();
    expect(count).toBe(1);
  });
});
