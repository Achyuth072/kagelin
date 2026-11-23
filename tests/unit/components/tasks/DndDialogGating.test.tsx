import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
import type { DragStartEvent } from "@dnd-kit/core";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import { useIsAnyModalOpen } from "@/lib/hooks/useIsAnyModalOpen";
import { useUiStore } from "@/lib/store/uiStore";
import { useTaskDnd } from "@/components/tasks/useTaskDnd";
import type { TaskPresentation } from "@/lib/types/task-view";
import type { Task } from "@/lib/types/task";

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ isAddTaskOpen: false }),
}));
vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({ isHabitSheetOpen: false }),
}));
vi.mock("@/components/ProjectActionsProvider", () => ({
  useProjectActions: () => ({ isCreateProjectOpen: false }),
}));
vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: () => ({ isCreateEventOpen: false }),
}));
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));
vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useUpdateTask: () => ({ mutate: vi.fn() }),
  useReorderTasks: () => ({ mutate: vi.fn() }),
}));

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

const initialPresentation: TaskPresentation = {
  active: [t1],
  evening: [],
  completed: [],
  groups: null,
};

describe("Dnd and Modal/Dialog Gating", () => {
  beforeEach(() => {
    useUiStore.setState({
      isShortcutsHelpOpen: false,
      isArchivedProjectsOpen: false,
      isChangelogOpen: false,
    });
  });

  it("useIsAnyModalOpen returns true when DeleteConfirmationDialog is open", () => {
    const { result: modalOpenResult, rerender: rerenderHook } = renderHook(() =>
      useIsAnyModalOpen(),
    );
    expect(modalOpenResult.current).toBe(false);

    const { rerender: rerenderDialog, unmount } = render(
      <DeleteConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    rerenderHook();
    expect(modalOpenResult.current).toBe(true);

    rerenderDialog(
      <DeleteConfirmationDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    rerenderHook();
    expect(modalOpenResult.current).toBe(false);

    unmount();
  });

  it("useTaskDnd ignores drag start and resets active state when disabled is true", () => {
    const { result, rerender } = renderHook(
      ({ disabled }) =>
        useTaskDnd({
          presentation: initialPresentation,
          disabled,
          isDesktop: true,
        }),
      { initialProps: { disabled: false } },
    );

    expect(result.current.sensors.length).toBeGreaterThan(0);

    rerender({ disabled: true });

    act(() => {
      result.current.onDragStart({
        active: {
          id: "t1",
          data: { current: {} },
          rect: { current: { initial: null, translated: null } },
        },
      } as unknown as DragStartEvent);
    });

    expect(result.current.activeId).toBeNull();
    expect(result.current.activeTask).toBeNull();
    expect(result.current.isDragging).toBe(false);
  });
});
