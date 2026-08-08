import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { BoardTaskCard } from "@/components/tasks/BoardTaskCard";
import { ListTaskCard } from "@/components/tasks/ListTaskCard";
import { taskDomId } from "@/components/tasks/task-utils";
import type { ProcessedTasks } from "@/lib/hooks/useTaskViewData";
import type { Task } from "@/lib/types/task";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mutable fixtures the individual tests populate — kept outside the mock
// factories via vi.hoisted so vi.mock's hoisting doesn't strand them.
const taskState = vi.hoisted(() => ({ tasks: [] as Task[] }));
const uiState = vi.hoisted(() => ({
  viewMode: "board" as "board" | "list",
  isDesktop: true,
  selectedTaskId: null as string | null,
  setSelectedTaskId: vi.fn(),
  sortBy: "custom" as const,
  setSortBy: vi.fn(),
  customSortEnteredViaDrag: false,
  setCustomSortEnteredViaDrag: vi.fn(),
  isShortcutsHelpOpen: false,
  isArchivedProjectsOpen: false,
  isChangelogOpen: false,
}));
const mutations = vi.hoisted(() => ({
  toggleMutate: vi.fn(),
  deleteMutate: vi.fn(),
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
  useDeleteTask: () => ({ mutate: mutations.deleteMutate }),
  useToggleTask: () => ({ mutate: mutations.toggleMutate }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-js-loaded", () => ({
  useJsLoaded: () => true,
}));

vi.mock("@/components/tasks/TaskSheet", () => ({
  default: ({ open }: { open: boolean }) => (
    <div data-testid="task-sheet">{open ? "open" : "closed"}</div>
  ),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: (selector: (state: typeof uiState) => unknown) =>
    selector(uiState),
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

function isSelected(id: string): boolean {
  return (
    document.getElementById(taskDomId(id))?.getAttribute("aria-selected") ===
    "true"
  );
}

function selectedId(taskIds: string[]): string | undefined {
  return taskIds.find((id) => isSelected(id));
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

describe("Vim Keyboard Navigation & Highlighting", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    taskState.tasks = [];
    uiState.viewMode = "board";
    uiState.isDesktop = true;
  });

  it("applies inset ring highlight to BoardTaskCard when isKeyboardSelected is true", () => {
    const mockTask = buildTask({ id: "t1", content: "Board Task Highlight" });

    const { container } = render(
      <BoardTaskCard
        task={mockTask}
        project={undefined}
        handleComplete={vi.fn()}
        handlePlayFocus={vi.fn()}
        isKeyboardSelected={true}
      />,
    );

    const cardRoot = container.firstElementChild;
    expect(cardRoot?.className).toContain("ring-2");
    expect(cardRoot?.className).toContain("ring-primary");
    expect(cardRoot?.className).toContain("bg-secondary/40");
  });

  it("applies inset ring highlight to ListTaskCard when isKeyboardSelected is true", () => {
    const mockTask = buildTask({ id: "t1", content: "List Task Highlight" });

    const { container } = render(
      <ListTaskCard
        task={mockTask}
        isDesktop={true}
        isExpanded={false}
        toggleExpand={vi.fn()}
        handleComplete={vi.fn()}
        handlePlayFocus={vi.fn()}
        onDeleteRequest={vi.fn()}
        project={undefined}
        isKeyboardSelected={true}
      />,
    );

    const cardRoot = container.firstElementChild;
    expect(cardRoot?.className).toContain("ring-2");
    expect(cardRoot?.className).toContain("ring-primary");
    expect(cardRoot?.className).toContain("ring-inset");
    expect(cardRoot?.className).toContain("bg-secondary/40");
  });

  it("passes keyboardSelectedId down to BoardTaskCard in TaskBoard", () => {
    const processedTasks: ProcessedTasks = {
      active: [buildTask({ id: "t1", content: "Active 1" })],
      evening: [],
      completed: [],
      groups: null,
    };

    render(
      <TaskBoard
        processedTasks={processedTasks}
        projectsMap={new Map()}
        isDesktop={true}
        triggerHaptic={vi.fn()}
        setActiveTaskId={vi.fn()}
        keyboardSelectedId="t1"
      />,
    );

    const cardText = screen.getByText("Active 1");
    const boardCard = cardText.closest(".group\\/card");
    expect(boardCard?.className).toContain("ring-2");
    expect(boardCard?.className).toContain("ring-primary");
  });

  // Unlike the guest-mode-backed sibling suites (TaskListHotkeyGating.test.tsx,
  // KeyboardFocusModel.test.tsx), useTasks/useUiStore here are synchronous
  // in-memory mocks with no query fetch in the loop, so a render commits
  // fully before fireEvent.keyDown fires — no waitFor needed around the
  // assertions that follow.
  describe("behavioural navigation (TaskList integration)", () => {
    it("j/k in List view advance and reverse selection through navigableTasks", async () => {
      uiState.viewMode = "list";
      taskState.tasks = [
        buildTask({ id: "a", content: "Alpha", day_order: 0 }),
        buildTask({ id: "b", content: "Bravo", day_order: 1 }),
        buildTask({ id: "c", content: "Charlie", day_order: 2 }),
      ];
      await renderTaskList();

      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      expect(selectedId(["a", "b", "c"])).toBe("a");

      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      expect(selectedId(["a", "b", "c"])).toBe("b");

      fireEvent.keyDown(document, { key: "k", code: "KeyK" });
      expect(selectedId(["a", "b", "c"])).toBe("a");
    });

    it("h/l in Board view move between columns; j/k move within the active column", async () => {
      uiState.viewMode = "board";
      taskState.tasks = [
        buildTask({ id: "a1", content: "A1", day_order: 0 }),
        buildTask({ id: "a2", content: "A2", day_order: 1 }),
        buildTask({ id: "a3", content: "A3", day_order: 2 }),
        buildTask({
          id: "e1",
          content: "E1",
          day_order: 0,
          is_evening: true,
        }),
      ];
      await renderTaskList();
      const ids = ["a1", "a2", "a3", "e1"];

      // First "l" (with nothing selected) arms the first task in column 1.
      fireEvent.keyDown(document, { key: "l", code: "KeyL" });
      expect(selectedId(ids)).toBe("a1");

      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      expect(selectedId(ids)).toBe("a2");
      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      expect(selectedId(ids)).toBe("a3");
      fireEvent.keyDown(document, { key: "k", code: "KeyK" });
      expect(selectedId(ids)).toBe("a2");

      // "l" moves into the This Evening column, clamped to its one row.
      fireEvent.keyDown(document, { key: "l", code: "KeyL" });
      expect(selectedId(ids)).toBe("e1");

      // "h" moves back to Tasks — row index carries over from the column
      // just left (row 0 in "This Evening"), not the row Tasks was left at.
      fireEvent.keyDown(document, { key: "h", code: "KeyH" });
      expect(selectedId(ids)).toBe("a1");
    });

    it("h/l are inert in List view", async () => {
      uiState.viewMode = "list";
      taskState.tasks = [
        buildTask({ id: "a", content: "Alpha", day_order: 0 }),
        buildTask({ id: "b", content: "Bravo", day_order: 1 }),
      ];
      await renderTaskList();

      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      expect(selectedId(["a", "b"])).toBe("a");

      fireEvent.keyDown(document, { key: "l", code: "KeyL" });
      expect(selectedId(["a", "b"])).toBe("a");

      fireEvent.keyDown(document, { key: "h", code: "KeyH" });
      expect(selectedId(["a", "b"])).toBe("a");
    });

    it("column navigation skips empty columns and clamps the row index into short columns", async () => {
      uiState.viewMode = "board";
      taskState.tasks = [
        buildTask({ id: "a1", content: "A1", day_order: 0 }),
        buildTask({ id: "a2", content: "A2", day_order: 1 }),
        buildTask({ id: "a3", content: "A3", day_order: 2 }),
        // "This Evening" is empty — the only column to the right of Tasks.
      ];
      await renderTaskList();
      const ids = ["a1", "a2", "a3"];

      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      expect(selectedId(ids)).toBe("a3");

      // The only column to the right is empty, so "l" finds nothing and the
      // selection does not move off the board's real content.
      fireEvent.keyDown(document, { key: "l", code: "KeyL" });
      expect(selectedId(ids)).toBe("a3");
    });

    it("Space toggles completion on the selected task", async () => {
      uiState.viewMode = "list";
      taskState.tasks = [
        buildTask({ id: "a", content: "Alpha", day_order: 0 }),
      ];
      await renderTaskList();

      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      expect(selectedId(["a"])).toBe("a");

      fireEvent.keyDown(document, { key: " ", code: "Space" });
      expect(mutations.toggleMutate).toHaveBeenCalledWith({
        id: "a",
        is_completed: true,
      });
    });

    it("d / Backspace deletes and advances selection", async () => {
      uiState.viewMode = "list";
      taskState.tasks = [
        buildTask({ id: "a", content: "Alpha", day_order: 0 }),
        buildTask({ id: "b", content: "Bravo", day_order: 1 }),
        buildTask({ id: "c", content: "Charlie", day_order: 2 }),
      ];
      await renderTaskList();

      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      expect(selectedId(["a", "b", "c"])).toBe("a");

      fireEvent.keyDown(document, { key: "d", code: "KeyD" });
      expect(mutations.deleteMutate).toHaveBeenCalledWith("a");
      // Selection advances before the row it deleted is actually removed
      // from the (still-cached) task list.
      expect(selectedId(["a", "b", "c"])).toBe("b");
    });

    it("task hotkeys do not fire while a modal is open", async () => {
      uiState.viewMode = "list";
      taskState.tasks = [
        buildTask({ id: "a", content: "Alpha", day_order: 0 }),
        buildTask({ id: "b", content: "Bravo", day_order: 1 }),
      ];
      await renderTaskList();

      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      expect(selectedId(["a", "b"])).toBe("a");

      // Enter opens TaskSheet — isAnyModalOpen is derived from that same
      // `selectedTask` state, so gating is correct on this very render.
      fireEvent.keyDown(document, { key: "Enter", code: "Enter" });
      expect(screen.getByTestId("task-sheet").textContent).toBe("open");

      fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
      expect(selectedId(["a", "b"])).toBe("a");

      fireEvent.keyDown(document, { key: "d", code: "KeyD" });
      expect(mutations.deleteMutate).not.toHaveBeenCalled();
    });

    it("Arrow keys and Space are not swallowed when nothing is selected", async () => {
      uiState.viewMode = "list";
      taskState.tasks = [
        buildTask({ id: "a", content: "Alpha", day_order: 0 }),
      ];
      await renderTaskList();

      const spaceResult = fireEvent.keyDown(document, {
        key: " ",
        code: "Space",
      });
      expect(spaceResult).toBe(true); // not cancelled — native scroll stays live
      expect(mutations.toggleMutate).not.toHaveBeenCalled();
      expect(selectedId(["a"])).toBeUndefined();

      const arrowResult = fireEvent.keyDown(document, {
        key: "ArrowDown",
        code: "ArrowDown",
      });
      expect(arrowResult).toBe(true); // arms selection without claiming the key
      expect(selectedId(["a"])).toBe("a");
    });
  });
});
