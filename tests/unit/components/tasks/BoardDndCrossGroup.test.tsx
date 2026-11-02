/**
 * Regression test for cross-group snap-back in TaskBoard.
 *
 * A cross-column drop fires two mutations (the group property, then day_order).
 * The first one's invalidateQueries can refetch stale server data before the
 * second commits, so the parent re-renders with the task back in its old column.
 * useTaskDnd holds a local display lock until every mutation's onSettled fires,
 * which keeps the card in its dropped column for the whole in-flight window.
 */

import type { ReactNode } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { useTaskDnd } from "@/components/tasks/useTaskDnd";
import { useReorderTasks, useUpdateTask } from "@/lib/hooks/useTaskMutations";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task, Project } from "@/lib/types/task";
import type { ProcessedTasks } from "@/lib/hooks/useTaskViewData";

// --- Capture DndContext handlers ---
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

// Mock SortableBoardTaskCard to render a simple element carrying the task id
vi.mock("@/components/tasks/SortableBoardTaskCard", () => ({
  SortableBoardTaskCard: ({ task }: { task: Task }) => (
    <div data-testid={`card-${task.id}`} />
  ),
}));

vi.mock("@/components/tasks/TaskGhost", () => ({
  TaskGhost: () => <div data-testid="task-ghost" />,
}));

// KanbanBoardProvider just renders children
vi.mock("@/components/kanban", () => ({
  KanbanBoardProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/lib/hooks/use-js-loaded", () => ({
  useJsLoaded: () => true,
}));

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useReorderTasks: vi.fn(),
  useUpdateTask: vi.fn(),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

// --- Task fixtures ---
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

// t1, t2 in "High" (priority=2); t3 in "Critical" (priority=1)
const t1 = makeTask("t1", 2, 2);
const t2 = makeTask("t2", 2, 3);
const t3 = makeTask("t3", 1, 0);

// processedTasks with t1 STILL in High (stale / pre-fix server data)
const staleProcessedTasks: ProcessedTasks = {
  active: [t1, t2, t3],
  evening: [],
  completed: [],
  groups: [
    { title: "Critical", tasks: [t3] },
    { title: "High", tasks: [t1, t2] },
  ],
};

// processedTasks with t1 MOVED to Critical (correct post-mutation server data)
const correctProcessedTasks: ProcessedTasks = {
  active: [{ ...t1, priority: 1 }, t2, t3],
  evening: [],
  completed: [],
  groups: [
    { title: "Critical", tasks: [{ ...t1, priority: 1 }, t3] },
    { title: "High", tasks: [t2] },
  ],
};

const defaultProps = {
  projectsMap: new Map<string, Project>(),
  isDesktop: true,
  triggerHaptic: vi.fn(),
  setActiveTaskId: vi.fn(),
};

function BoardTestHarness({
  presentation: currentProcessedTasks,
}: {
  presentation: ProcessedTasks;
}) {
  const dnd = useTaskDnd({
    presentation: currentProcessedTasks,
    groupBy: "priority",
    sortBy: "custom",
    isDesktop: true,
  });

  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={dnd.collisionDetection}
      onDragStart={dnd.onDragStart}
      onDragOver={dnd.onDragOver}
      onDragEnd={dnd.onDragEnd}
      onDragCancel={dnd.onDragCancel}
    >
      <TaskBoard presentation={dnd.displayPresentation} {...defaultProps} />
    </DndContext>
  );
}

describe("TaskBoard — cross-group snap-back regression", () => {
  let reorderMutateMock: ReturnType<typeof vi.fn>;
  let updateMutateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    captured.handlers = {};
    reorderMutateMock = vi.fn();
    updateMutateMock = vi.fn();

    vi.mocked(useReorderTasks).mockReturnValue({
      mutate: reorderMutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useReorderTasks>);

    vi.mocked(useUpdateTask).mockReturnValue({
      mutate: updateMutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>);

    vi.mocked(useUiStore).mockImplementation((selector) =>
      selector({
        sortBy: "custom",
        groupBy: "none",
        viewMode: "board",
        boardInspectMode: "overlay",
        setSortBy: vi.fn(),
        setGroupBy: vi.fn(),
        setViewMode: vi.fn(),
        setBoardInspectMode: vi.fn(),
        customSortEnteredViaDrag: false,
        setCustomSortEnteredViaDrag: vi.fn(),
        habitViewMode: "grid",
        setHabitViewMode: vi.fn(),
        statsPeriod: "30d",
        setStatsPeriod: vi.fn(),
        isProjectsOpen: true,
        toggleProjectsOpen: vi.fn(),
        timeFormat: "system",
        setTimeFormat: vi.fn(),
        hapticsEnabled: false,
        setHapticsEnabled: vi.fn(),
        notificationsEnabled: false,
        setNotificationsEnabled: vi.fn(),
        backupReminderEnabled: true,
        setBackupReminderEnabled: vi.fn(),
        backupReminderFrequencyDays: 7,
        setBackupReminderFrequencyDays: vi.fn(),
        autoLockEnabled: false,
        setAutoLockEnabled: vi.fn(),
        autoLockMinutes: 60,
        setAutoLockMinutes: vi.fn(),
        isShortcutsHelpOpen: false,
        setShortcutsHelpOpen: vi.fn(),
        isPipActive: false,
        setIsPipActive: vi.fn(),
        isArchivedProjectsOpen: false,
        setArchivedProjectsOpen: vi.fn(),
        selectedTaskId: null,
        setSelectedTaskId: vi.fn(),
        editingTaskId: null,
        setEditingTaskId: vi.fn(),
        isDesktop: true,
        setIsDesktop: vi.fn(),
        lastSeenVersion: "",
        setLastSeenVersion: vi.fn(),
        lastDismissedVersion: "",
        setLastDismissedVersion: vi.fn(),
        isChangelogOpen: false,
        setChangelogOpen: vi.fn(),
        _hasHydrated: true,
        setHasHydrated: vi.fn(),
        isFullscreen: false,
        setIsFullscreen: vi.fn(),
        isSynced: false,
        setIsSynced: vi.fn(),
        hasChangelogUpdate: false,
        setHasChangelogUpdate: vi.fn(),
        goals: {
          dailyFocusHours: null,
          weeklyFocusHours: null,
          dailyTasksCompleted: null,
          weeklyTasksCompleted: null,
        },
        setGoals: vi.fn(),
        lastUndoAction: null,
        setLastUndoAction: vi.fn(),
        triggerLastUndoAction: vi.fn(),
        yankedTaskId: null,
        setYankedTaskId: vi.fn(),
        shortcutTipsEnabled: true,
        setShortcutTipsEnabled: vi.fn(),
        shownShortcutTips: {},
        shortcutMouseCounts: {},
        incrementShortcutMouseCount: vi.fn(() => false),
        setShortcutMouseCount: vi.fn(),
        markShortcutTipShown: vi.fn(),
        startHereStates: {},
        setStartHereState: vi.fn(),
      }),
    );
  });

  /**
   * Helper: check which column task `id` is rendered in.
   * Returns "Critical" | "High" | null.
   */
  function getTaskColumn(taskId: string): string | null {
    const card = document.querySelector(`[data-testid="card-${taskId}"]`);
    if (!card) return null;
    const section = card.closest("section");
    if (!section) return null;
    const heading = section.querySelector("h3");
    // Read only the first text node to avoid including the task-count <span>
    return (
      (heading?.childNodes[0] as Text | undefined)?.textContent?.trim() ?? null
    );
  }

  it("holds the display lock until mutations settle on onSettled without polling", () => {
    const { rerender } = render(
      <BoardTestHarness presentation={staleProcessedTasks} />,
    );

    expect(getTaskColumn("t1")).toBe("High");

    act(() => {
      captured.handlers.onDragStart?.({ active: { id: "t1" } });
    });
    act(() => {
      captured.handlers.onDragOver?.({
        active: { id: "t1" },
        over: { id: "Critical" },
      });
    });

    expect(getTaskColumn("t1")).toBe("Critical");

    act(() => {
      captured.handlers.onDragEnd?.({
        active: { id: "t1" },
        over: { id: "t3" },
      });
    });

    // updateMutation fires for the priority change (hasChanged=true).
    // The reorder mutation is skipped for this drop: t1 is already positioned
    // immediately after t3 in the flat list, so no day_order change is needed.
    expect(updateMutateMock).toHaveBeenCalledOnce();
    expect(reorderMutateMock).not.toHaveBeenCalled();

    const updateOnSettled: (() => void) | undefined =
      updateMutateMock.mock.calls[0]?.[1]?.onSettled;

    expect(updateOnSettled).toBeDefined();

    // Stale refetch: the parent re-renders with old server data (t1 back in
    // High) while the mutation is still in flight. The display lock must win.
    act(() => {
      rerender(<BoardTestHarness presentation={staleProcessedTasks} />);
    });

    expect(getTaskColumn("t1")).toBe("Critical");

    act(() => {
      updateOnSettled?.();
    });

    act(() => {
      rerender(<BoardTestHarness presentation={correctProcessedTasks} />);
    });

    expect(getTaskColumn("t1")).toBe("Critical");
    expect(getTaskColumn("t1")).not.toBe("High");
  });

  it("releases lock immediately for same-column reorder (no updateMutation)", () => {
    render(<BoardTestHarness presentation={staleProcessedTasks} />);

    act(() => {
      captured.handlers.onDragStart?.({ active: { id: "t1" } });
    });
    act(() => {
      captured.handlers.onDragOver?.({
        active: { id: "t1" },
        over: { id: "t2" },
      });
    });
    act(() => {
      captured.handlers.onDragEnd?.({
        active: { id: "t1" },
        over: { id: "t2" },
      });
    });

    // Same column means no field change, so only the reorder mutation fires.
    expect(updateMutateMock).not.toHaveBeenCalled();
    expect(reorderMutateMock).toHaveBeenCalledOnce();

    const reorderOnSettled: (() => void) | undefined =
      reorderMutateMock.mock.calls[0]?.[1]?.onSettled;
    expect(reorderOnSettled).toBeDefined();

    act(() => {
      reorderOnSettled?.();
    });

    expect(getTaskColumn("t1")).toBe("High");
    expect(getTaskColumn("t2")).toBe("High");
  });
});
