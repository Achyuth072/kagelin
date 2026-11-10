import { renderHook, waitFor } from "@testing-library/react";
import { useTasks } from "@/lib/hooks/useTasks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockStore } from "@/lib/mock/mock-store";
import { AuthProvider } from "@/components/AuthProvider";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockGetSession = vi.fn();

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  })),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe("useTasks hook (Task Continuity Data)", () => {
  beforeEach(() => {
    queryClient.clear();
    mockStore.clearData();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    // Force Guest Mode for testing mockStore logic
    localStorage.setItem("kanso_guest_mode", "true");
  });

  it("should return today's completed tasks even when showCompleted is false", async () => {
    // Given: An active task and a task completed today
    const now = new Date();
    const todayStr = now.toISOString();

    mockStore.addTask({
      id: "active-1",
      content: "Active Task",
      is_completed: false,
    });
    mockStore.addTask({
      id: "completed-today",
      content: "Completed Today",
      is_completed: true,
      completed_at: todayStr,
    });
    mockStore.addTask({
      id: "completed-yesterday",
      content: "Completed Yesterday",
      is_completed: true,
      completed_at: new Date(now.getTime() - 86400000).toISOString(),
    });

    // When: useTasks is called with showCompleted: false (default)
    const { result } = renderHook(() => useTasks(), { wrapper });

    // Then: It should include the active task AND today's completed task
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const taskIds = result.current.data?.map((t) => t.id);
    expect(taskIds).toContain("active-1");

    // THIS IS THE BUG: Currently it filters out "completed-today"
    // We WANT it to contain "completed-today" for task continuity
    expect(taskIds).toContain("completed-today");
    expect(taskIds).not.toContain("completed-yesterday");
  });

  it("should aggregate subtasks by parent_id in guest mode", async () => {
    // Given: A parent task with subtasks
    mockStore.addTask({
      id: "parent-task",
      content: "Parent Task",
      is_completed: false,
    });
    mockStore.addTask({
      id: "sub-1",
      parent_id: "parent-task",
      content: "Subtask 1",
      is_completed: true,
    });
    mockStore.addTask({
      id: "sub-2",
      parent_id: "parent-task",
      content: "Subtask 2",
      is_completed: false,
    });

    // When: useTasks is called
    const { result } = renderHook(() => useTasks(), { wrapper });

    // Then: The parent task should contain the subtasks array with completion state
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const parent = result.current.data?.find((t) => t.id === "parent-task");
    expect(parent).toBeDefined();
    expect(parent?.subtasks).toHaveLength(2);
    expect(parent?.subtasks).toEqual(
      expect.arrayContaining([
        { id: "sub-1", is_completed: true },
        { id: "sub-2", is_completed: false },
      ]),
    );
  });

  it("should fetch root tasks and subtasks concurrently via Promise.all in non-guest mode", async () => {
    localStorage.removeItem("kanso_guest_mode");
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
      },
    });

    const paginate = await import("@/lib/supabase/paginate");
    let tasksInvoked = false;
    let stepsInvokedWhileTasksPending = false;

    vi.spyOn(paginate, "fetchAllRows").mockImplementation(async () => {
      if (!tasksInvoked) {
        tasksInvoked = true;
        await new Promise((r) => setTimeout(r, 20));
        return [
          {
            id: "root-1",
            content: "Root task",
            parent_id: null,
            day_order: 0,
            created_at: "2026-01-01",
          },
        ];
      } else {
        stepsInvokedWhileTasksPending = true;
        return [
          {
            id: "step-1",
            parent_id: "root-1",
            is_completed: true,
          },
        ];
      }
    });

    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(stepsInvokedWhileTasksPending).toBe(true);
    expect(result.current.data?.[0].subtasks).toEqual([
      { id: "step-1", is_completed: true },
    ]);
  });
});
