import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TasksPageHeader } from "@/components/tasks/TasksPageHeader";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(),
}));

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
  function renderHeader() {
    return render(
      <TasksPageHeader
        currentSort="date"
        currentGroup="none"
        viewMode="list"
        onSortChange={vi.fn()}
        onGroupChange={vi.fn()}
        onViewModeChange={vi.fn()}
      />,
    );
  }

  it("offers the Board tab on mobile viewports", () => {
    vi.mocked(useMediaQuery).mockReturnValue(false);
    renderHeader();

    expect(screen.getByRole("tab", { name: /board/i })).toBeInTheDocument();
  });

  it("offers the Board tab on desktop viewports", () => {
    vi.mocked(useMediaQuery).mockReturnValue(true);
    renderHeader();

    expect(screen.getByRole("tab", { name: /board/i })).toBeInTheDocument();
  });
});
