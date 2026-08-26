/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { startOfWeek } from "date-fns";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: vi.fn() }));

import { useTasks, useTaskSeries } from "@/lib/hooks/useTasks";
import { useDedicatedCalendarEventsQuery } from "@/lib/hooks/useCalendarEventsList";
import { useGoalProgress } from "@/lib/hooks/useGoalProgress";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { cappedClient } from "../../support/supabaseRowCap";

const mockCreateClient = vi.mocked(createClient);
const mockUseAuth = vi.mocked(useAuth);

const TOTAL = 1200;
const SERIES_ID = "series-1";

// Every row lands just after this week's Monday boundary, so the week-scoped
// useGoalProgress queries see the same 1200 rows the unscoped ones do.
const weekStartMs = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
const at = (i: number) => new Date(weekStartMs + i * 1000).toISOString();

const allTasks = Array.from({ length: TOTAL }, (_, i) => ({
  id: `task-${i}`,
  content: `Task ${i}`,
  parent_id: null,
  recurring_series_id: SERIES_ID,
  is_completed: true,
  completed_at: at(i),
  day_order: i,
  created_at: at(i),
  projects: null,
}));

const allLogs = Array.from({ length: TOTAL }, (_, i) => ({
  start_time: at(i),
  duration_seconds: 60,
}));

const allEvents = Array.from({ length: TOTAL }, (_, i) => ({
  id: `event-${i}`,
  title: `Event ${i}`,
  start_time: at(i),
  is_archived: false,
}));

describe("list hooks against the PostgREST 1000-row cap", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
    mockCreateClient.mockReturnValue(
      cappedClient({
        tasks: allTasks,
        focus_logs: allLogs,
        calendar_events: allEvents,
      }),
    );
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("useTasks returns the full completed-task history", async () => {
    const { result } = renderHook(
      () => useTasks({ projectId: "all", showCompleted: true }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(TOTAL);
  });

  it("useTaskSeries returns every occurrence in the series", async () => {
    const { result } = renderHook(() => useTaskSeries(SERIES_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(TOTAL);
  });

  it("useDedicatedCalendarEventsQuery returns every unarchived event", async () => {
    const { result } = renderHook(() => useDedicatedCalendarEventsQuery(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(TOTAL);
  });

  it("useGoalProgress counts every session and task in the week", async () => {
    const { result } = renderHook(() => useGoalProgress(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const progress = result.current.data!;

    // 1200 * 60s = 20h. Truncated at the row cap it would be 1000 * 60s = 16.7h.
    expect(progress.focusHoursThisWeek).toBeCloseTo(20, 1);
    expect(progress.tasksCompletedThisWeek).toBe(TOTAL);
  });
});
