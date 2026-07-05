/**
 * Regression test for: dragging within a grouped, derived-sorted view must not
 * rearrange the OTHER groups when the drop converts the view to custom sort.
 *
 * Bug: handleDragEnd persists the drop via computeReorderPairs, which models it
 * as a single-task move and only rewrites day_order for the dragged task's own
 * section. Every other group keeps its stale (derived) day_order. The instant
 * sortBy flips to "custom", those other groups re-sort by that stale day_order —
 * which does not match the order they were displaying — so they visibly jump.
 *
 * The single-move strategy is only correct when ALREADY in custom sort (day_order
 * authoritative). When a drag CONVERTS a derived view, the whole visible order
 * must be frozen. This test drives a same-group reorder under a priority sort and
 * asserts the persisted pairs preserve the untouched group's display order.
 */

import type { ReactNode } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { useReorderTasks, useUpdateTask } from "@/lib/hooks/useTaskMutations";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task, Project } from "@/lib/types/task";
import type { ProcessedTasks } from "@/lib/hooks/useTaskViewData";

type MockOver = {
  id: string;
  data?: { current?: { sortable?: { index?: number; containerId?: string } } };
};
type DndHandlers = {
  onDragStart?: (event: { active: { id: string } }) => void;
  onDragOver?: (event: {
    active: { id: string };
    over: MockOver | null;
  }) => void;
  onDragEnd?: (event: {
    active: { id: string };
    over: MockOver | null;
  }) => void;
};
const captured: { handlers: DndHandlers } = { handlers: {} };

vi.mock("@dnd-kit/core", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragOver,
      onDragEnd,
    }: {
      children: ReactNode;
      onDragStart?: DndHandlers["onDragStart"];
      onDragOver?: DndHandlers["onDragOver"];
      onDragEnd?: DndHandlers["onDragEnd"];
    }) => {
      captured.handlers.onDragStart = onDragStart;
      captured.handlers.onDragOver = onDragOver;
      captured.handlers.onDragEnd = onDragEnd;
      return <div data-testid="dnd-context">{children}</div>;
    },
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

vi.mock("@/components/tasks/SortableBoardTaskCard", () => ({
  SortableBoardTaskCard: ({ task }: { task: Task }) => (
    <div data-testid={`card-${task.id}`} />
  ),
}));
vi.mock("@/components/tasks/TaskGhost", () => ({
  TaskGhost: () => <div data-testid="task-ghost" />,
}));
vi.mock("@/components/kanban", () => ({
  KanbanBoardProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/lib/hooks/use-js-loaded", () => ({ useJsLoaded: () => true }));
vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useReorderTasks: vi.fn(),
  useUpdateTask: vi.fn(),
}));
vi.mock("@/lib/store/uiStore", () => ({ useUiStore: vi.fn() }));
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

const makeTask = (id: string, priority: number, dayOrder: number): Task => ({
  id,
  user_id: "guest",
  content: `Task ${id}`,
  description: null,
  is_completed: false,
  completed_at: null,
  priority: priority as Task["priority"],
  project_id: null,
  day_order: dayOrder,
  created_at: "2026-05-14T00:00:00.000Z",
  updated_at: "2026-05-14T00:00:00.000Z",
  due_date: null,
  do_date: null,
  is_evening: false,
  parent_id: null,
  recurrence: null,
  recurring_series_id: null,
  google_event_id: null,
  google_etag: null,
});

// Critical group (priority 1) shown as [c1, c2]; High group (priority 2) shown
// as [h1, h2]. day_order deliberately DIVERGES from the shown order (this is
// what a derived sort looks like: display order != day_order order).
const c1 = makeTask("c1", 1, 10);
const c2 = makeTask("c2", 1, 4);
const h1 = makeTask("h1", 2, 8);
const h2 = makeTask("h2", 2, 1);
const INITIAL_DAY_ORDER: Record<string, number> = {
  c1: 10,
  c2: 4,
  h1: 8,
  h2: 1,
};

const processedTasks: ProcessedTasks = {
  active: [c1, c2, h1, h2],
  evening: [],
  completed: [],
  groups: [
    { title: "Critical", tasks: [c1, c2] },
    { title: "High", tasks: [h1, h2] },
  ],
};

const defaultProps = {
  projectsMap: new Map<string, Project>(),
  isDesktop: true,
  triggerHaptic: vi.fn(),
  setActiveTaskId: vi.fn(),
};

describe("TaskBoard — grouped drag under a derived sort", () => {
  let reorderMutateMock: ReturnType<typeof vi.fn>;
  let setSortByMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    captured.handlers = {};
    reorderMutateMock = vi.fn();
    setSortByMock = vi.fn();

    vi.mocked(useReorderTasks).mockReturnValue({
      mutate: reorderMutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useReorderTasks>);
    vi.mocked(useUpdateTask).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>);

    vi.mocked(useUiStore).mockImplementation((selector) =>
      selector({
        // Derived sort — the drop will convert this to custom.
        sortBy: "priority",
        groupBy: "priority",
        viewMode: "board",
        setSortBy: setSortByMock,
        setGroupBy: vi.fn(),
        setViewMode: vi.fn(),
        customSortEnteredViaDrag: false,
        setCustomSortEnteredViaDrag: vi.fn(),
        isDesktop: true,
      } as unknown as Parameters<Parameters<typeof useUiStore>[0]>[0]),
    );
  });

  it("preserves the untouched group's order when a same-group reorder converts to custom", () => {
    render(<TaskBoard processedTasks={processedTasks} {...defaultProps} />);

    // Drag h2 above h1 within the High group. Each step is wrapped in act() so
    // React flushes the local-state update and the captured handlers refresh to
    // closures over the latest localColumns (mirrors BoardDndCrossGroup).
    act(() => {
      captured.handlers.onDragStart?.({ active: { id: "h2" } });
    });
    act(() => {
      captured.handlers.onDragOver?.({
        active: { id: "h2" },
        over: { id: "h1", data: { current: { sortable: { index: 0 } } } },
      });
    });
    act(() => {
      captured.handlers.onDragEnd?.({
        active: { id: "h2" },
        over: { id: "h1", data: { current: { sortable: { index: 0 } } } },
      });
    });

    // The drop converts to custom sort.
    expect(setSortByMock).toHaveBeenCalledWith("custom");

    // Apply the persisted pairs on top of the initial day_orders.
    expect(reorderMutateMock).toHaveBeenCalledTimes(1);
    const pairs = reorderMutateMock.mock.calls[0][0] as {
      id: string;
      day_order: number;
    }[];
    const finalOrder: Record<string, number> = { ...INITIAL_DAY_ORDER };
    for (const p of pairs) finalOrder[p.id] = p.day_order;

    // The untouched Critical group must still sort as [c1, c2] under custom
    // (its shown order) — not flip to [c2, c1] because its day_order was stale.
    const criticalSorted = ["c1", "c2"].sort(
      (a, b) => finalOrder[a] - finalOrder[b],
    );
    expect(criticalSorted).toEqual(["c1", "c2"]);

    // And the dragged High group reflects the drop order [h2, h1].
    const highSorted = ["h1", "h2"].sort(
      (a, b) => finalOrder[a] - finalOrder[b],
    );
    expect(highSorted).toEqual(["h2", "h1"]);
  });
});
