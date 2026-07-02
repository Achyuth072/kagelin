import type React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TaskSheet from "@/components/tasks/TaskSheet";
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

const renderWithQuery = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useInboxProject: vi.fn(),
  useTaskSeries: vi.fn(() => ({ data: [], isLoading: false })),
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

const seriesTask = {
  id: "1",
  content: "Recurring Task",
  priority: 4,
  is_completed: false,
  recurring_series_id: "series-1",
} as unknown as Task;

const oneOffTask = {
  id: "2",
  content: "One-off Task",
  priority: 4,
  is_completed: false,
  recurring_series_id: null,
} as unknown as Task;

describe("TaskSheet — Insights tab gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useCreateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (useUpdateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (useDeleteTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (useToggleTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (useInboxProject as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { id: "inbox-id" },
    });
    (useProjects as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
    });
  });

  it("shows the Edit/Insights toggle for a task in a Series", async () => {
    await act(async () => {
      renderWithQuery(
        <TaskSheet open={true} onClose={() => {}} initialTask={seriesTask} />,
      );
    });

    expect(
      await screen.findByRole("tab", { name: "Insights" }),
    ).toBeInTheDocument();
  });

  it("hides the toggle for a one-off task (no Series)", async () => {
    await act(async () => {
      renderWithQuery(
        <TaskSheet open={true} onClose={() => {}} initialTask={oneOffTask} />,
      );
    });

    expect(await screen.findByText("Edit Task")).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Insights" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to Edit when initialTab='insights' is stale on a one-off task", async () => {
    await act(async () => {
      renderWithQuery(
        <TaskSheet
          open={true}
          onClose={() => {}}
          initialTask={oneOffTask}
          initialTab="insights"
        />,
      );
    });

    expect(
      await screen.findByPlaceholderText("What needs to be done?"),
    ).toBeInTheDocument();
  });

  it("toggles to Insights and back for a Series task", async () => {
    await act(async () => {
      renderWithQuery(
        <TaskSheet open={true} onClose={() => {}} initialTask={seriesTask} />,
      );
    });

    await act(async () => {
      fireEvent.mouseDown(await screen.findByRole("tab", { name: "Insights" }));
    });
    expect(
      screen.queryByPlaceholderText("What needs to be done?"),
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Edit" }));
    });
    expect(
      await screen.findByPlaceholderText("What needs to be done?"),
    ).toBeInTheDocument();
  });
});
