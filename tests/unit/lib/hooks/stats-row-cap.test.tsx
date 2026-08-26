/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: vi.fn() }));

import { useStats } from "@/lib/hooks/useStats";
import { useHeatmapData } from "@/lib/hooks/useHeatmapData";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { cappedClient } from "../../support/supabaseRowCap";

const mockCreateClient = vi.mocked(createClient);
const mockUseAuth = vi.mocked(useAuth);

const TOTAL_LOGS = 1200;
const HOUR = 60 * 60 * 1000;

// One session per hour going back from now, oldest first.
const allLogs = Array.from({ length: TOTAL_LOGS }, (_, i) => ({
  start_time: new Date(Date.now() - (TOTAL_LOGS - i) * HOUR).toISOString(),
  duration_seconds: 1500,
}));

// Completed tasks on the same cadence, split evenly across two projects and all
// four priorities, so a truncated fetch skews the breakdowns as well as the totals.
const allTasks = Array.from({ length: TOTAL_LOGS }, (_, i) => ({
  is_completed: true,
  completed_at: new Date(Date.now() - (TOTAL_LOGS - i) * HOUR).toISOString(),
  project_id: i % 2 === 0 ? "proj-a" : "proj-b",
  priority: ((i % 4) + 1) as 1 | 2 | 3 | 4,
}));

describe("stats surfaces against the PostgREST 1000-row cap", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
    mockCreateClient.mockReturnValue(
      cappedClient({ focus_logs: allLogs, tasks: allTasks }),
    );
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("useStats feeds every headline metric card the full row set", async () => {
    const { result } = renderHook(() => useStats("all"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const stats = result.current.data!;

    // Sessions + Total Focus cards
    expect(stats.totalSessions).toBe(TOTAL_LOGS);
    expect(stats.totalFocusHours).toBeCloseTo((TOTAL_LOGS * 1500) / 3600, 0);
    // Tasks + Rate cards
    expect(stats.tasksCompleted).toBe(TOTAL_LOGS);
    expect(stats.completionRate).toBe(100);
  });

  it("useStats feeds the charts and breakdowns the full row set", async () => {
    const { result } = renderHook(() => useStats("all"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const stats = result.current.data!;

    // ProjectBreakdownCard / PriorityBreakdownCard
    expect(stats.byProject.reduce((sum, p) => sum + p.count, 0)).toBe(
      TOTAL_LOGS,
    );
    expect(stats.byPriority.reduce((sum, p) => sum + p.count, 0)).toBe(
      TOTAL_LOGS,
    );
    // TimeOfDayHeatmap — minutes, so 1200 * 25min
    expect(stats.timeOfDay.flat().reduce((sum, m) => sum + m, 0)).toBeCloseTo(
      TOTAL_LOGS * 25,
      -1,
    );
    // FocusTrendChart — every session lands in some day bucket
    expect(stats.dailyTrend.reduce((sum, d) => sum + d.totalSessions, 0)).toBe(
      TOTAL_LOGS,
    );
  });

  it("useStats counts every session inside a bounded period too", async () => {
    const { result } = renderHook(() => useStats("1y"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.totalSessions).toBe(TOTAL_LOGS);
  });

  it("useHeatmapData sums every session across its 365-day window", async () => {
    const { result } = renderHook(() => useHeatmapData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const totalFocusHours = result.current.data.reduce(
      (sum, d) => sum + d.focus,
      0,
    );
    // All 1200 sessions fall inside the 365-day window: 1200 * 1500s = 500h.
    // Truncated at the row cap it would be 1000 * 1500s = 416.7h.
    expect(totalFocusHours).toBeCloseTo((TOTAL_LOGS * 1500) / 3600, 0);
  });
});
