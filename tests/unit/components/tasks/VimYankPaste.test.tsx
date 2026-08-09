import { render, fireEvent } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task } from "@/lib/types/task";

const taskState = vi.hoisted(() => ({ tasks: [] as Task[] }));
const mutations = vi.hoisted(() => ({
  duplicateMutate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => ({
    data: taskState.tasks,
    isLoading: false,
  }),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: () => ({ data: [] }),
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn(), isAddTaskOpen: false }),
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

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useReorderTasks: () => ({ mutate: vi.fn() }),
  useUpdateTask: () => ({ mutate: vi.fn() }),
  useDeleteTask: () => ({ mutate: vi.fn() }),
  useToggleTask: () => ({ mutate: vi.fn() }),
  useDuplicateTask: () => ({ mutate: mutations.duplicateMutate }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/notify", () => ({
  notify: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("@/components/tasks/TaskSheet", () => ({
  default: ({ open }: { open: boolean }) => (
    <div data-testid="task-sheet">{open ? "open" : "closed"}</div>
  ),
}));

function buildTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    user_id: "u1",
    content: overrides.id,
    priority: 4,
    is_completed: false,
    project_id: null,
    parent_id: null,
    description: null,
    due_date: null,
    do_date: null,
    is_evening: false,
    day_order: 0,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
    completed_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

async function renderTaskList() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TaskList />
    </QueryClientProvider>,
  );
}

describe("Vim Yank & Paste Controls (yy / p)", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    taskState.tasks = [];
    mutations.duplicateMutate.mockReset();
    useUiStore.setState({
      viewMode: "list",
      isDesktop: true,
      selectedTaskId: null,
      yankedTask: null,
    });
  });

  it("yy yanks the selected task into uiStore", async () => {
    const taskA = buildTask({ id: "a", content: "Alpha Task" });
    const taskB = buildTask({ id: "b", content: "Bravo Task" });
    taskState.tasks = [taskA, taskB];
    await renderTaskList();

    // Select task A with j
    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });

    // Double press y
    fireEvent.keyDown(document, { key: "y", code: "KeyY" });
    fireEvent.keyDown(document, { key: "y", code: "KeyY" });

    const yanked = useUiStore.getState().yankedTask;
    expect(yanked).toBeDefined();
    expect(yanked?.id).toBe("a");
    expect(yanked?.content).toBe("Alpha Task");
  });

  it("p triggers duplicate mutation for the yanked task", async () => {
    const taskA = buildTask({ id: "a", content: "Alpha Task" });
    taskState.tasks = [taskA];
    useUiStore.setState({ yankedTask: taskA });

    await renderTaskList();

    // Press p
    fireEvent.keyDown(document, { key: "p", code: "KeyP" });

    expect(mutations.duplicateMutate).toHaveBeenCalledTimes(1);
    expect(mutations.duplicateMutate).toHaveBeenCalledWith(
      taskA,
      expect.any(Object),
    );
  });

  it("p does nothing if no task is yanked", async () => {
    const taskA = buildTask({ id: "a", content: "Alpha Task" });
    taskState.tasks = [taskA];
    useUiStore.setState({ yankedTask: null });

    await renderTaskList();

    fireEvent.keyDown(document, { key: "p", code: "KeyP" });

    expect(mutations.duplicateMutate).not.toHaveBeenCalled();
  });

  it("escape releases the yanked task, so a later p no longer pastes", async () => {
    const taskA = buildTask({ id: "a", content: "Alpha Task" });
    taskState.tasks = [taskA];
    useUiStore.setState({ yankedTask: taskA });

    await renderTaskList();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(useUiStore.getState().yankedTask).toBeNull();

    fireEvent.keyDown(document, { key: "p", code: "KeyP" });
    expect(mutations.duplicateMutate).not.toHaveBeenCalled();
  });
});
