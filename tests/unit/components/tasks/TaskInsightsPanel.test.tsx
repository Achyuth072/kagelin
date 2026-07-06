import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskInsightsPanel } from "@/components/tasks/TaskInsightsPanel";
import type { Task } from "@/lib/types/task";
import * as useTasksModule from "@/lib/hooks/useTasks";

vi.mock("@/lib/hooks/useTasks");
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

const mockTask: Task = {
  id: "t1",
  user_id: "u1",
  project_id: null,
  parent_id: null,
  content: "Weekly Review",
  description: null,
  priority: 2,
  due_date: "2026-06-25T09:00:00.000Z",
  do_date: null,
  is_evening: false,
  is_completed: false,
  completed_at: null,
  day_order: 0,
  recurrence: { freq: "WEEKLY", interval: 1 },
  recurring_series_id: "series-1",
  google_event_id: null,
  google_etag: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function occ(id: string, dueDate: string, isCompleted: boolean): Task {
  return {
    ...mockTask,
    id,
    due_date: `${dueDate}T09:00:00.000Z`,
    is_completed: isCompleted,
    completed_at: isCompleted ? `${dueDate}T09:00:00.000Z` : null,
  };
}

describe("TaskInsightsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while fetching", () => {
    vi.mocked(useTasksModule.useTaskSeries).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useTasksModule.useTaskSeries>);

    render(<TaskInsightsPanel task={mockTask} />);

    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });

  it("shows empty state when the Series has no Occurrences", () => {
    vi.mocked(useTasksModule.useTaskSeries).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTasksModule.useTaskSeries>);

    render(<TaskInsightsPanel task={mockTask} />);

    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("renders Overview and History with Occurrences", () => {
    vi.mocked(useTasksModule.useTaskSeries).mockReturnValue({
      data: [
        occ("t1", "2026-06-04", true),
        occ("t2", "2026-06-11", true),
        occ("t3", "2026-06-18", false),
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useTasksModule.useTaskSeries>);

    render(<TaskInsightsPanel task={mockTask} />);

    expect(screen.getByText("Completion Rate")).toBeInTheDocument();
    expect(screen.getByText("On-Time")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });
});
