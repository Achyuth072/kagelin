import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TasksPageHeader } from "@/components/tasks/TasksPageHeader";

import { useShortcutTips } from "@/lib/hooks/useShortcutTips";
import { useCompletedTasks } from "@/components/CompletedTasksProvider";

vi.mock("@/lib/hooks/useShortcutTips", () => ({
  useShortcutTips: vi.fn(() => ({
    recordMouseAction: vi.fn(),
    recordKeyAction: vi.fn(),
  })),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/components/CompletedTasksProvider", () => ({
  useCompletedTasks: vi.fn(() => ({ openSheet: vi.fn() })),
}));

vi.mock("@/components/ui/SyncIndicator", () => ({
  SyncIndicator: () => null,
}));

describe("TasksPageHeader", () => {
  it("offers the Board tab", () => {
    render(
      <TasksPageHeader
        currentSort="date"
        currentGroup="none"
        viewMode="list"
        onSortChange={vi.fn()}
        onGroupChange={vi.fn()}
        onViewModeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: /board/i })).toBeInTheDocument();
  });

  it("records mouse action for newTask when New Task is clicked", () => {
    const onNewTask = vi.fn();
    const mockRecordMouseAction = vi.fn();
    vi.mocked(useShortcutTips).mockReturnValue({
      recordMouseAction: mockRecordMouseAction,
      recordKeyAction: vi.fn(),
    });

    render(
      <TasksPageHeader
        currentSort="date"
        currentGroup="none"
        viewMode="list"
        onSortChange={vi.fn()}
        onGroupChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onNewTask={onNewTask}
      />,
    );

    const newTaskBtn = screen.getByRole("button", { name: /new task/i });
    newTaskBtn.click();

    expect(mockRecordMouseAction).toHaveBeenCalledWith("newTask");
    expect(onNewTask).toHaveBeenCalledTimes(1);
  });

  it("records mouse action for logbook when Completed is clicked", () => {
    const mockRecordMouseAction = vi.fn();
    const mockOpenSheet = vi.fn();
    vi.mocked(useShortcutTips).mockReturnValue({
      recordMouseAction: mockRecordMouseAction,
      recordKeyAction: vi.fn(),
    });
    vi.mocked(useCompletedTasks).mockReturnValue({
      openSheet: mockOpenSheet,
      closeSheet: vi.fn(),
      isSheetOpen: false,
      showCompleted: false,
      toggleShowCompleted: vi.fn(),
    });

    render(
      <TasksPageHeader
        currentSort="date"
        currentGroup="none"
        viewMode="list"
        onSortChange={vi.fn()}
        onGroupChange={vi.fn()}
        onViewModeChange={vi.fn()}
      />,
    );

    const completedBtn = screen.getByRole("button", { name: /completed/i });
    completedBtn.click();

    expect(mockRecordMouseAction).toHaveBeenCalledWith("logbook");
    expect(mockOpenSheet).toHaveBeenCalledTimes(1);
  });
});
