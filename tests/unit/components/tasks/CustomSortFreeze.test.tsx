/**
 * Regression test for: switching the sort menu from a derived sort (e.g.
 * Alphabetical) to "Custom" must PRESERVE the currently-visible order.
 *
 * The bug: useTaskViewData re-sorts by day_order the instant sortBy becomes
 * "custom". day_order is unrelated to the derived order the user was viewing,
 * so the list visibly jumps. The "freeze" that is supposed to bake the visible
 * order into day_order reads processedTasks AFTER it has already been re-sorted,
 * so it freezes the jumped order (a no-op) instead of the pre-switch order.
 *
 * This test exercises the REAL pipeline — real query cache, real useTasks
 * (guest mode over a controllable mock store), real useReorderTasks + real
 * taskMutations.reorder (guest path persists into the mock store, closing the
 * refetch loop), and real useTaskViewData. Only TaskListView is mocked, down to
 * a thin renderer of the active-section order, so the assertion is on the
 * observable display order rather than dnd-kit/TaskItem internals.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task } from "@/lib/types/task";

// ---------------------------------------------------------------------------
// Controllable in-memory task store shared by useTasks (guest) and
// taskMutations.reorder (guest). Reset per test.
// ---------------------------------------------------------------------------
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

// Thin TaskListView: render the active-section order so we can assert on it.
vi.mock("@/components/tasks/TaskListView", () => ({
  TaskListView: ({ activeTasks }: { activeTasks: { id: string }[] }) => (
    <div data-testid="active-order">
      {activeTasks.map((t) => t.id).join(",")}
    </div>
  ),
}));

vi.mock("@/components/tasks/TaskMasonryGrid", () => ({
  TaskMasonryGrid: () => <div data-testid="task-grid-view" />,
}));
vi.mock("@/components/tasks/TaskBoard", () => ({
  TaskBoard: () => <div data-testid="task-board-view" />,
}));
vi.mock("@/components/tasks/TaskGhost", () => ({
  TaskGhost: () => <div data-testid="task-ghost" />,
}));
vi.mock("@/components/tasks/TaskSheet", () => ({ default: () => null }));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn() }),
}));
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

// dnd-kit: passthrough context + stub sensors (mirrors existing DnD tests).
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function Harness() {
  const [sort, setSort] = useState<"alphabetical" | "custom">("alphabetical");
  return (
    <>
      <button onClick={() => setSort("custom")}>go-custom</button>
      <TaskList sortBy={sort} groupBy="none" projectId="all" />
    </>
  );
}

const order = () => screen.getByTestId("active-order").textContent;

describe("Custom sort menu switch — freeze visible order", () => {
  beforeEach(() => {
    // day_order is the REVERSE of alphabetical, so custom-by-day_order diverges
    // from the alphabetical display order.
    storeState.tasks = [
      makeTask("a", "Alpha", 4),
      makeTask("b", "Bravo", 3),
      makeTask("c", "Charlie", 2),
      makeTask("d", "Delta", 1),
      makeTask("e", "Echo", 0),
    ];
    localStorage.setItem("kanso_guest_mode", "true");
    useUiStore.setState({
      viewMode: "list",
      isDesktop: true,
      customSortEnteredViaDrag: false,
      selectedTaskId: null,
    });
  });

  it("keeps the visible (alphabetical) order when switching to Custom via the menu", async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>,
    );

    // Under Alphabetical, the visible order is a,b,c,d,e.
    await waitFor(() => expect(order()).toBe("a,b,c,d,e"));

    // Switch to Custom via the (menu-equivalent) sortBy change.
    fireEvent.click(screen.getByText("go-custom"));

    // The order must NOT jump. With the bug it becomes e,d,c,b,a (day_order).
    await waitFor(() => expect(order()).toBe("a,b,c,d,e"));
  });
});
