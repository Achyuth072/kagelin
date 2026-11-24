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

function occ(
  id: string,
  dueDate: string,
  isCompleted: boolean,
  completedAt: string | null = null,
): Task {
  return {
    ...mockTask,
    id,
    due_date: `${dueDate}T09:00:00.000Z`,
    is_completed: isCompleted,
    completed_at: isCompleted
      ? completedAt
        ? `${completedAt}T09:00:00.000Z`
        : `${dueDate}T09:00:00.000Z`
      : null,
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

  it("renders outcome overview cards and discrete completion log instead of HabitHeatmap", () => {
    vi.mocked(useTasksModule.useTaskSeries).mockReturnValue({
      data: [
        occ("t1", "2026-06-04", true),
        occ("t2", "2026-06-11", true),
        occ("t3", "2026-06-18", false),
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useTasksModule.useTaskSeries>);

    const { container } = render(<TaskInsightsPanel task={mockTask} />);

    // Outcome metrics
    expect(screen.getByText("Total Completions")).toBeInTheDocument();
    expect(screen.getByText("On-Time Delivery Rate")).toBeInTheDocument();
    expect(screen.getByText("Completion Breakdown")).toBeInTheDocument();

    // Zero streaks
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Current Streak")).not.toBeInTheDocument();
    expect(screen.queryByText("Best Streak")).not.toBeInTheDocument();

    // Zero habit heatmap
    expect(
      container.querySelector(".react-activity-calendar"),
    ).not.toBeInTheDocument();

    // Discrete completion log entries
    expect(screen.getByText(/completion history/i)).toBeInTheDocument();
    expect(screen.getByText("Jun 4, 2026")).toBeInTheDocument();
    expect(screen.getByText("Jun 11, 2026")).toBeInTheDocument();
  });

  it("differentiates on-time and late outcomes in discrete completion event list", () => {
    vi.mocked(useTasksModule.useTaskSeries).mockReturnValue({
      data: [
        occ("t1", "2026-06-04", true, "2026-06-04"), // On-time
        occ("t2", "2026-06-11", true, "2026-06-15"), // Late
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useTasksModule.useTaskSeries>);

    render(<TaskInsightsPanel task={mockTask} />);

    expect(screen.getByText("On time")).toBeInTheDocument();
    const lateBadge = screen.getByText("Late");
    expect(lateBadge).toBeInTheDocument();
    expect(lateBadge).toHaveClass("text-muted-foreground");
    expect(lateBadge).not.toHaveClass("text-destructive");
  });

  it("shows empty completion state when occurrences exist but none are completed", () => {
    vi.mocked(useTasksModule.useTaskSeries).mockReturnValue({
      data: [occ("t1", "2026-06-04", false), occ("t2", "2026-06-11", false)],
      isLoading: false,
    } as unknown as ReturnType<typeof useTasksModule.useTaskSeries>);

    render(<TaskInsightsPanel task={mockTask} />);

    expect(
      screen.getByText("No completed occurrences recorded yet."),
    ).toBeInTheDocument();
  });
});
