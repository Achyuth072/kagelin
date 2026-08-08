/**
 * Regression test for: task-level vim hotkeys (j/k/enter/escape/etc.) must be
 * disabled while any modal or sheet is open, and Escape must be able to clear
 * the keyboard selection.
 *
 * The bug: the old gating predicate queried the DOM for `[role="dialog"]`
 * during render, which reads `false` on the exact render where a dialog opens
 * (its portal hasn't committed yet) — so hotkeys stayed armed while a modal
 * was open. This test drives the real hotkey bindings (via react-hotkeys-hook
 * on the real DOM) against the real `selectedTask` state that opens
 * TaskSheet, so it fails under the old DOM-probe predicate and passes under
 * the state-derived `useIsAnyModalOpen` one.
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task } from "@/lib/types/task";

const storeState = vi.hoisted(() => ({ tasks: [] as Task[] }));

vi.mock("@/lib/mock/mock-store", () => ({
  mockStore: {
    getTasks: () => storeState.tasks,
    getProjects: () => [],
    updateTask: (id: string, updates: Partial<Task>) => {
      storeState.tasks = storeState.tasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      );
      return storeState.tasks.find((t) => t.id === id) ?? null;
    },
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: true }),
}));

vi.mock("@/components/tasks/TaskListView", () => ({
  TaskListView: ({
    keyboardSelectedId,
    activeTasks,
  }: {
    keyboardSelectedId: string | null;
    activeTasks: { id: string }[];
  }) => (
    <>
      <div data-testid="keyboard-selected">{keyboardSelectedId ?? ""}</div>
      <div data-testid="active-count">{activeTasks.length}</div>
    </>
  ),
}));

vi.mock("@/components/tasks/TaskBoard", () => ({
  TaskBoard: () => <div data-testid="task-board-view" />,
}));
vi.mock("@/components/tasks/TaskGhost", () => ({
  TaskGhost: () => <div data-testid="task-ghost" />,
}));
vi.mock("@/components/tasks/TaskSheet", () => ({
  default: ({ open }: { open: boolean }) => (
    <div data-testid="task-sheet">{open ? "open" : "closed"}</div>
  ),
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
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@dnd-kit/core", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children }: { children: ReactNode }) => (
      <div data-testid="dnd-context">{children}</div>
    ),
    DragOverlay: ({ children }: { children: ReactNode }) => (
      <div data-testid="drag-overlay">{children}</div>
    ),
    useDroppable: () => ({ setNodeRef: vi.fn() }),
    useSensor: vi.fn((sensor, options) => ({ sensor, options })),
    useSensors: vi.fn((...sensors) => sensors),
  };
});
vi.mock("@dnd-kit/sortable", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/sortable")>(
      "@dnd-kit/sortable",
    );
  return {
    ...actual,
    SortableContext: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    sortableKeyboardCoordinates: vi.fn(),
  };
});

const makeTask = (id: string, content: string, dayOrder: number): Task => ({
  id,
  user_id: "guest",
  content,
  description: null,
  is_completed: false,
  completed_at: null,
  priority: 4,
  project_id: null,
  day_order: dayOrder,
  created_at: "2026-05-06T00:00:00.000Z",
  updated_at: "2026-05-06T00:00:00.000Z",
  due_date: null,
  do_date: null,
  is_evening: false,
  parent_id: null,
  recurrence: null,
  recurring_series_id: null,
  google_event_id: null,
  google_etag: null,
});

const selected = () => screen.getByTestId("keyboard-selected").textContent;
const sheetState = () => screen.getByTestId("task-sheet").textContent;

async function renderTaskList() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const result = render(
    <QueryClientProvider client={qc}>
      <TaskList sortBy="custom" groupBy="none" projectId="all" />
    </QueryClientProvider>,
  );
  // Wait for the guest task fetch to resolve before driving hotkeys —
  // navigableTasks is empty (so "j" is a no-op) until then.
  await waitFor(() =>
    expect(screen.getByTestId("active-count").textContent).toBe("3"),
  );
  return result;
}

describe("TaskList hotkey gating", () => {
  beforeEach(() => {
    storeState.tasks = [
      makeTask("a", "Alpha", 0),
      makeTask("b", "Bravo", 1),
      makeTask("c", "Charlie", 2),
    ];
    localStorage.setItem("kanso_guest_mode", "true");
    useUiStore.setState({
      viewMode: "list",
      isDesktop: true,
      selectedTaskId: null,
      isShortcutsHelpOpen: false,
      isArchivedProjectsOpen: false,
      isChangelogOpen: false,
    });
  });

  it("arms the selection and steps through tasks with j", async () => {
    await renderTaskList();
    await waitFor(() => expect(selected()).toBe(""));

    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
    await waitFor(() => expect(selected()).toBe("a"));

    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
    await waitFor(() => expect(selected()).toBe("b"));
  });

  it("opens TaskSheet on Enter, and blocks further j navigation while it is open", async () => {
    await renderTaskList();
    await waitFor(() => expect(selected()).toBe(""));

    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
    await waitFor(() => expect(selected()).toBe("a"));

    fireEvent.keyDown(document, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(sheetState()).toBe("open"));

    // The gating predicate is state-derived (selectedTask), so it is already
    // true on this render — no DOM-probe lag to wait out.
    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
    expect(selected()).toBe("a");
  });

  it("clears the selection on Escape", async () => {
    await renderTaskList();
    await waitFor(() => expect(selected()).toBe(""));

    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
    await waitFor(() => expect(selected()).toBe("a"));

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(selected()).toBe(""));
  });

  it("does not preventDefault on ArrowDown until a task is selected, and claims it once armed", async () => {
    await renderTaskList();
    await waitFor(() => expect(selected()).toBe(""));

    // Nothing selected yet — the keypress arms the first task, but must not
    // cancel the browser's native scroll.
    const first = fireEvent.keyDown(document, {
      key: "ArrowDown",
      code: "ArrowDown",
    });
    expect(first).toBe(true); // not cancelled — page scroll stays live
    await waitFor(() => expect(selected()).toBe("a"));

    // Now that vim mode is armed, ArrowDown claims the keypress.
    const second = fireEvent.keyDown(document, {
      key: "ArrowDown",
      code: "ArrowDown",
    });
    expect(second).toBe(false); // cancelled — vim navigation owns it now
    await waitFor(() => expect(selected()).toBe("b"));
  });
});
