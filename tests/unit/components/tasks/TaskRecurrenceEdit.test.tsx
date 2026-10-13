import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TaskSheet from "@/components/tasks/TaskSheet";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import type { Task } from "@/lib/types/task";
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useToggleTask,
} from "@/lib/hooks/useTaskMutations";
import { useInboxProject } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const renderWithQuery = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useCreateTask: vi.fn(),
  useUpdateTask: vi.fn(),
  useDeleteTask: vi.fn(),
  useToggleTask: vi.fn(),
  useReorderTasks: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useInboxProject: vi.fn(),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: vi.fn(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: true, user: { id: "user-123" } })),
}));

vi.mock("@/lib/hooks/useSubtasks", () => ({
  useSubtasks: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn(), isPhone: false }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn().mockReturnValue(false),
}));

const mockRecurringTask: Task = {
  id: "recurring-task-1",
  user_id: "user-123",
  project_id: null,
  content: "Daily Standup",
  description: "Notes",
  priority: 4,
  due_date: "2026-10-12T10:00:00.000Z",
  do_date: null,
  is_evening: false,
  is_completed: false,
  completed_at: null,
  day_order: 0,
  recurrence: { freq: "DAILY", interval: 1 },
  recurring_series_id: "series-1",
  google_event_id: null,
  google_etag: null,
  parent_id: null,
  created_at: "2026-10-12T00:00:00.000Z",
  updated_at: "2026-10-12T00:00:00.000Z",
};

describe("Recurrence UI in TaskView edit views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useCreateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useUpdateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useDeleteTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useToggleTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useInboxProject as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { id: "inbox-id" },
    });
    (useProjects as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
    });
  });

  it("shows recurrence badge and title in TaskSheet edit view when task has recurrence", async () => {
    renderWithQuery(
      <TaskSheet
        open={true}
        onClose={() => {}}
        initialTask={mockRecurringTask}
      />,
    );

    // The recurrence button should indicate Daily recurrence with badge D
    await waitFor(() => {
      const recurrenceBtn = screen.getByTitle("Daily");
      expect(recurrenceBtn).toBeInTheDocument();
      expect(recurrenceBtn).toHaveTextContent("D");
    });
    expect(screen.queryByTitle("Does not repeat")).toBeNull();
  });

  it("shows recurrence badge and title in TaskDetailPanel edit view when task has recurrence", async () => {
    renderWithQuery(
      <TaskDetailPanel task={mockRecurringTask} onClose={() => {}} />,
    );

    // Wait for dynamic TaskView to load and verify recurrence button
    await waitFor(() => {
      const recurrenceBtn = screen.getByTitle("Daily");
      expect(recurrenceBtn).toBeInTheDocument();
      expect(recurrenceBtn).toHaveTextContent("D");
    });
    expect(screen.queryByTitle("Does not repeat")).toBeNull();
  });

  it("submits the updated recurrence when saved from TaskSheet edit view", async () => {
    const mockUpdateMutate = vi.fn();
    (useUpdateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    });

    renderWithQuery(
      <TaskSheet
        open={true}
        onClose={() => {}}
        initialTask={mockRecurringTask}
      />,
    );

    // Click Save
    const saveButton = await screen.findByRole("button", { name: /save/i });
    saveButton.click();

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "recurring-task-1",
          recurrence: { freq: "DAILY", interval: 1 },
        }),
      );
    });
  });

  it("submits the updated recurrence when saved from TaskDetailPanel edit view", async () => {
    const mockUpdateMutate = vi.fn();
    (useUpdateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    });

    renderWithQuery(
      <TaskDetailPanel task={mockRecurringTask} onClose={() => {}} />,
    );

    // Click Save
    const saveButton = await screen.findByRole("button", { name: /save/i });
    saveButton.click();

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "recurring-task-1",
          recurrence: { freq: "DAILY", interval: 1 },
        }),
      );
    });
  });
});
