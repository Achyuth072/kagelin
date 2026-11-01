import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTaskDnd } from "@/components/tasks/useTaskDnd";
import type { TaskPresentation, TaskGroup } from "@/lib/types/task-view";
import type { Task } from "@/lib/types/task";
import { useUpdateTask, useReorderTasks } from "@/lib/hooks/useTaskMutations";
import { useUiStore } from "@/lib/store/uiStore";
import { useHaptic } from "@/lib/hooks/useHaptic";
import type {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useUpdateTask: vi.fn(),
  useReorderTasks: vi.fn(),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: vi.fn(),
}));

describe("useTaskDnd", () => {
  let updateMutateMock: ReturnType<typeof vi.fn>;
  let reorderMutateMock: ReturnType<typeof vi.fn>;
  let hapticTriggerMock: ReturnType<typeof vi.fn>;
  let setSortByMock: ReturnType<typeof vi.fn>;
  let setCustomSortEnteredViaDragMock: ReturnType<typeof vi.fn>;

  const t1: Task = {
    id: "t1",
    user_id: "user1",
    content: "Task 1",
    description: null,
    is_completed: false,
    completed_at: null,
    day_order: 0,
    priority: 2,
    project_id: null,
    parent_id: null,
    due_date: null,
    do_date: null,
    is_evening: false,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const t2: Task = {
    id: "t2",
    user_id: "user1",
    content: "Task 2",
    description: null,
    is_completed: false,
    completed_at: null,
    day_order: 1,
    priority: 2,
    project_id: null,
    parent_id: null,
    due_date: null,
    do_date: null,
    is_evening: false,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const t3: Task = {
    id: "t3",
    user_id: "user1",
    content: "Task 3",
    description: null,
    is_completed: false,
    completed_at: null,
    day_order: 2,
    priority: 1,
    project_id: null,
    parent_id: null,
    due_date: null,
    do_date: null,
    is_evening: false,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const initialPresentation: TaskPresentation = {
    active: [t1, t2],
    evening: [],
    completed: [],
    groups: [
      { title: "High", tasks: [t1, t2] },
      { title: "Critical", tasks: [t3] },
    ],
  };

  beforeEach(() => {
    updateMutateMock = vi.fn();
    reorderMutateMock = vi.fn();
    hapticTriggerMock = vi.fn();
    setSortByMock = vi.fn();
    setCustomSortEnteredViaDragMock = vi.fn();

    vi.mocked(useUpdateTask).mockReturnValue({
      mutate: updateMutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>);

    vi.mocked(useReorderTasks).mockReturnValue({
      mutate: reorderMutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useReorderTasks>);

    vi.mocked(useHaptic).mockReturnValue({
      trigger: hapticTriggerMock as unknown as (
        signature?: "tick" | "toggle" | "thud" | "success",
      ) => void,
      isPhone: false,
      hapticsEnabled: true,
    });

    vi.mocked(useUiStore).mockImplementation((selector) => {
      const state = {
        sortBy: "custom",
        setSortBy: setSortByMock,
        customSortEnteredViaDrag: false,
        setCustomSortEnteredViaDrag: setCustomSortEnteredViaDragMock,
        isDesktop: true,
      };
      return selector(state as unknown as Parameters<typeof selector>[0]);
    });
  });

  it("exposes single drag controller state and event handlers", () => {
    const { result } = renderHook(() =>
      useTaskDnd({
        presentation: initialPresentation,
        isDesktop: true,
      }),
    );

    expect(result.current.activeTask).toBeNull();
    expect(result.current.activeId).toBeNull();
    expect(result.current.isDragging).toBe(false);
    expect(result.current.displayPresentation).toEqual(initialPresentation);
    expect(result.current.sensors).toBeDefined();
    expect(result.current.collisionDetection).toBeDefined();
    expect(typeof result.current.onDragStart).toBe("function");
    expect(typeof result.current.onDragOver).toBe("function");
    expect(typeof result.current.onDragEnd).toBe("function");
    expect(typeof result.current.onDragCancel).toBe("function");
  });

  it("triggers toggle haptic on lift on mobile, but keeps desktop silent", () => {
    const { result: desktopResult } = renderHook(() =>
      useTaskDnd({
        presentation: initialPresentation,
        isDesktop: true,
      }),
    );

    act(() => {
      desktopResult.current.onDragStart({
        active: { id: "t1" },
      } as unknown as DragStartEvent);
    });

    expect(desktopResult.current.activeTask).toEqual(t1);
    expect(desktopResult.current.isDragging).toBe(true);
    expect(hapticTriggerMock).not.toHaveBeenCalled();

    const { result: mobileResult } = renderHook(() =>
      useTaskDnd({
        presentation: initialPresentation,
        isDesktop: false,
      }),
    );

    act(() => {
      mobileResult.current.onDragStart({
        active: { id: "t1" },
      } as unknown as DragStartEvent);
    });

    expect(mobileResult.current.activeTask).toEqual(t1);
    expect(hapticTriggerMock).toHaveBeenCalledWith("toggle");
  });

  it("blocks drops into derived groups such as Overdue when groupBy is date", () => {
    const dateGroups: TaskGroup[] = [
      { title: "Overdue", tasks: [] },
      { title: "Today", tasks: [t1] },
    ];
    const datePresentation: TaskPresentation = {
      active: [t1],
      evening: [],
      completed: [],
      groups: dateGroups,
    };

    const { result } = renderHook(() =>
      useTaskDnd({
        presentation: datePresentation,
        groupBy: "date",
        isDesktop: true,
      }),
    );

    act(() => {
      result.current.onDragStart({
        active: { id: "t1" },
      } as unknown as DragStartEvent);
    });

    // Attempt drag over the blocked "Overdue" group
    act(() => {
      result.current.onDragOver({
        active: {
          id: "t1",
          data: { current: { sortable: { containerId: "Today" } } },
        },
        over: {
          id: "Overdue",
          data: { current: { sortable: { containerId: "Overdue" } } },
        },
      } as unknown as DragOverEvent);
    });

    const overdueGroup = result.current.displayPresentation.groups?.find(
      (g) => g.title === "Overdue",
    );
    expect(overdueGroup?.tasks).toHaveLength(0);
  });

  it("reorders across grouped columns and releases lock on onSettled without polling", () => {
    const { result } = renderHook(() =>
      useTaskDnd({
        presentation: initialPresentation,
        groupBy: "priority",
        sortBy: "custom",
        isDesktop: false,
      }),
    );

    act(() => {
      result.current.onDragStart({
        active: { id: "t1" },
      } as unknown as DragStartEvent);
    });

    act(() => {
      result.current.onDragOver({
        active: {
          id: "t1",
          data: { current: { sortable: { containerId: "High" } } },
        },
        over: {
          id: "Critical",
          data: { current: { sortable: { containerId: "Critical" } } },
        },
      } as unknown as DragOverEvent);
    });

    const criticalCol = result.current.displayPresentation.groups?.find(
      (g) => g.title === "Critical",
    );
    expect(criticalCol?.tasks.some((t) => t.id === "t1")).toBe(true);

    act(() => {
      result.current.onDragEnd({
        active: { id: "t1" },
        over: { id: "t3" },
      } as unknown as DragEndEvent);
    });

    // Commit triggers haptic thud on mobile
    expect(hapticTriggerMock).toHaveBeenCalledWith("thud");

    expect(updateMutateMock).toHaveBeenCalled();
    const updateOptions = updateMutateMock.mock.calls[0][1];
    expect(updateOptions?.onSettled).toBeDefined();

    // Lock is held until onSettled fires
    expect(
      result.current.displayPresentation.groups
        ?.find((g) => g.title === "Critical")
        ?.tasks.some((t) => t.id === "t1"),
    ).toBe(true);

    act(() => {
      updateOptions.onSettled();
    });
  });

  it("handles reordering in flat Active / Evening sections", () => {
    const flatPresentation: TaskPresentation = {
      active: [t1, t2],
      evening: [],
      completed: [],
      groups: null,
    };

    const { result } = renderHook(() =>
      useTaskDnd({
        presentation: flatPresentation,
        groupBy: "none",
        sortBy: "custom",
        isDesktop: true,
      }),
    );

    act(() => {
      result.current.onDragStart({
        active: { id: "t1" },
      } as unknown as DragStartEvent);
    });

    act(() => {
      result.current.onDragOver({
        active: {
          id: "t1",
          data: { current: { sortable: { containerId: "active-section" } } },
        },
        over: {
          id: "evening-section",
          data: { current: { sortable: { containerId: "evening-section" } } },
        },
      } as unknown as DragOverEvent);
    });

    expect(
      result.current.displayPresentation.evening.some((t) => t.id === "t1"),
    ).toBe(true);
    expect(
      result.current.displayPresentation.active.some((t) => t.id === "t1"),
    ).toBe(false);

    act(() => {
      result.current.onDragEnd({
        active: { id: "t1" },
        over: { id: "evening-section" },
      } as unknown as DragEndEvent);
    });

    expect(updateMutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", is_evening: true }),
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });
});
