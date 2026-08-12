/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import type { GroupOption } from "@/lib/types/sorting";

const boardProps = vi.fn();

vi.mock("@/components/tasks/TaskBoard", () => ({
  TaskBoard: (props: any) => {
    boardProps(props);
    return <div data-testid="task-board" />;
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ user: { id: "test-user" }, isGuestMode: false })),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: vi.fn(() => ({
    activeTasks: [],
    eveningTasks: [],
    completedTasks: [],
    groups: [],
    isLoading: false,
    allNavigableTasks: [],
  })),
  useInboxProject: vi.fn(() => ({ data: null, isLoading: false })),
  useTask: vi.fn(() => ({ data: null, isLoading: false })),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn((sel: any) => {
    const state = {
      sortBy: "custom",
      setSortBy: vi.fn(),
      groupBy: "none",
      viewMode: "board",
      isDesktop: false,
      selectedTaskId: null,
      setSelectedTaskId: vi.fn(),
      setCustomSortEnteredViaDrag: vi.fn(),
    };
    return sel ? sel(state) : state;
  }),
}));

vi.mock("@/lib/store/timerStore", () => ({
  useTimerStore: vi.fn((sel: any) => {
    const state = { setActiveTaskId: vi.fn() };
    return sel ? sel(state) : state;
  }),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useReorderTasks: vi.fn(() => ({ mutate: vi.fn() })),
  useUpdateTask: vi.fn(() => ({ mutate: vi.fn() })),
  useDeleteTask: vi.fn(() => ({ mutate: vi.fn() })),
  useToggleTask: vi.fn(() => ({ mutate: vi.fn() })),
  useCreateTask: vi.fn(() => ({ mutate: vi.fn() })),
  useDuplicateTask: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/lib/hooks/useTaskViewData", () => {
  const mockTask = {
    id: "1",
    content: "Task 1",
    day_order: 0,
    user_id: "user1",
    project_id: null,
    parent_id: null,
    description: null,
    priority: 4,
    due_date: null,
    do_date: null,
    is_evening: false,
    is_completed: false,
    completed_at: null,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    __esModule: true,
    useTaskViewData: vi.fn(() => ({
      active: [mockTask],
      evening: [],
      completed: [],
      groups: null,
    })),
    getBoardColumns: vi.fn(
      ({ groups, active, evening }: Record<string, unknown>) =>
        groups ?? [
          { title: "Tasks", tasks: active },
          { title: "This Evening", tasks: evening },
        ],
    ),
  };
});

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: vi.fn(() => ({ trigger: vi.fn() })),
}));

vi.mock("@/components/TimerProvider", () => ({
  useTimer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: vi.fn(() => ({ openAddTask: vi.fn(), isAddTaskOpen: false })),
}));

vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({ openAddHabit: vi.fn(), isHabitSheetOpen: false }),
}));

vi.mock("@/components/ProjectActionsProvider", () => ({
  useProjectActions: () => ({
    openCreateProject: vi.fn(),
    isCreateProjectOpen: false,
  }),
}));

vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: () => ({
    openCreateEvent: vi.fn(),
    isCreateEventOpen: false,
  }),
}));

// Regression guard: TaskList once forgot to pass groupBy to TaskBoard, so the
// board fell back to getTaskUpdatesForGroup's heuristic cascade — a project
// named "Today" read as a date bucket. task-dnd.test.ts covers the util;
// this asserts the wiring.
describe("TaskList -> TaskBoard groupBy wiring", () => {
  beforeEach(() => {
    boardProps.mockClear();
  });

  async function renderBoard(groupBy: GroupOption) {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TaskList sortBy="custom" groupBy={groupBy} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(boardProps).toHaveBeenCalled());
  }

  it("forwards groupBy so drop targets are interpreted strictly", async () => {
    await renderBoard("project");

    expect(boardProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ groupBy: "project" }),
    );
  });

  it("never leaves groupBy undefined on the board", async () => {
    await renderBoard("none");

    const props = boardProps.mock.lastCall?.[0];
    expect(props.groupBy).toBeDefined();
  });
});
