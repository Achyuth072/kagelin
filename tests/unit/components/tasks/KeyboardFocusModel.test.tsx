/**
 * Regression test for issue 05 — the keyboard focus model.
 *
 * Vim nav (j/k/h/l) drives `keyboardSelectedId` as React state; DOM focus
 * never moves to a card. That's virtual focus, so screen readers only learn
 * about the selection through `aria-activedescendant` wired up on the
 * scroll container — not through native tab order. This exercises the real
 * TaskListView/TaskBoard + card components (only dnd-kit primitives are
 * stubbed) so the assertions land on the actual DOM contract: container
 * role + aria-activedescendant, and per-card id + aria-selected.
 */

import type { ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import { useUiStore } from "@/lib/store/uiStore";
import { taskDomId } from "@/components/tasks/task-utils";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/tasks/TaskGhost", () => ({
  TaskGhost: () => <div data-testid="task-ghost" />,
}));
vi.mock("@/components/tasks/TaskSheet", () => ({ default: () => null }));

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
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      setActivatorNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
      isOver: false,
      active: null,
      over: null,
    }),
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

async function renderTaskList() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const result = render(
    <QueryClientProvider client={qc}>
      <TaskList sortBy="custom" groupBy="none" projectId="all" />
    </QueryClientProvider>,
  );
  // Wait for the guest task fetch to resolve — navigableTasks is empty (so
  // "j" is a no-op) until then.
  await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
  return result;
}

describe("Keyboard focus model (aria-activedescendant)", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    storeState.tasks = [
      makeTask("a", "Alpha", 0),
      makeTask("b", "Bravo", 1),
      makeTask("c", "Charlie", 2),
    ];
    localStorage.setItem("kanso_guest_mode", "true");
  });

  it("list view: container is a listbox whose aria-activedescendant tracks j/k, and the selected row is an aria-selected option", async () => {
    useUiStore.setState({
      viewMode: "list",
      isDesktop: true,
      selectedTaskId: null,
      isShortcutsHelpOpen: false,
      isArchivedProjectsOpen: false,
      isChangelogOpen: false,
    });
    const { container } = await renderTaskList();

    const scrollContainer = container.querySelector(
      "[data-task-list-scroll-container='true']",
    ) as HTMLElement;
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer.getAttribute("role")).toBe("listbox");
    expect(scrollContainer.getAttribute("aria-activedescendant")).toBeNull();

    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });

    const firstId = taskDomId("a");
    await waitFor(() =>
      expect(scrollContainer.getAttribute("aria-activedescendant")).toBe(
        firstId,
      ),
    );
    // DOM focus stays on the container, not the card — this is virtual
    // focus, not roving tabindex.
    expect(document.activeElement).toBe(scrollContainer);

    const firstRow = document.getElementById(firstId);
    expect(firstRow?.getAttribute("role")).toBe("option");
    expect(firstRow?.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
    const secondId = taskDomId("b");
    await waitFor(() =>
      expect(scrollContainer.getAttribute("aria-activedescendant")).toBe(
        secondId,
      ),
    );
    expect(firstRow?.getAttribute("aria-selected")).toBe("false");
  });

  it("board view: container is a grid whose aria-activedescendant tracks navigation, and the selected card is an aria-selected gridcell", async () => {
    useUiStore.setState({
      viewMode: "board",
      isDesktop: true,
      selectedTaskId: null,
      isShortcutsHelpOpen: false,
      isArchivedProjectsOpen: false,
      isChangelogOpen: false,
    });
    const { container } = await renderTaskList();

    const scrollContainer = container.querySelector(
      "[data-task-list-scroll-container='true']",
    ) as HTMLElement;
    expect(scrollContainer.getAttribute("role")).toBe("grid");

    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });

    const firstId = taskDomId("a");
    await waitFor(() =>
      expect(scrollContainer.getAttribute("aria-activedescendant")).toBe(
        firstId,
      ),
    );
    expect(document.activeElement).toBe(scrollContainer);

    const firstCard = document.getElementById(firstId);
    expect(firstCard?.getAttribute("role")).toBe("gridcell");
    expect(firstCard?.getAttribute("aria-selected")).toBe("true");
  });
});
