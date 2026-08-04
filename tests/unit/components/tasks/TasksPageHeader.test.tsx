import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TasksPageHeader } from "@/components/tasks/TasksPageHeader";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/components/CompletedTasksProvider", () => ({
  useCompletedTasks: () => ({ openSheet: vi.fn() }),
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
});
