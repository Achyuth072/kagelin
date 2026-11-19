import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TaskOverviewCards } from "@/components/tasks/insights/TaskOverviewCards";
import type { TaskOccurrence } from "@/lib/utils/task-metrics";

function occ(
  dueDate: string,
  isCompleted: boolean,
  completedAt: string | null = null,
): TaskOccurrence {
  return {
    due_date: `${dueDate}T09:00:00.000Z`,
    is_completed: isCompleted,
    completed_at: completedAt ? `${completedAt}T09:00:00.000Z` : null,
  };
}

describe("TaskOverviewCards", () => {
  it("renders outcome metrics without streak cards or habit icons", () => {
    render(<TaskOverviewCards occurrences={[]} />);

    expect(screen.getByText("Total Completions")).toBeInTheDocument();
    expect(screen.getByText("On-Time Delivery Rate")).toBeInTheDocument();
    expect(screen.getByText("Completion Breakdown")).toBeInTheDocument();

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Current Streak")).not.toBeInTheDocument();
    expect(screen.queryByText("Best Streak")).not.toBeInTheDocument();
  });

  it("shows placeholder rates and zero completions for empty occurrences", () => {
    render(<TaskOverviewCards occurrences={[]} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2); // On-Time Delivery Rate and Breakdown
  });

  it("computes outcome metrics from occurrences without streak logic", () => {
    const occurrences = [
      occ("2026-06-04", true, "2026-06-04"), // on-time
      occ("2026-06-11", true, "2026-06-12"), // late
      occ("2026-06-18", false), // uncompleted
    ];

    render(<TaskOverviewCards occurrences={occurrences} />);

    expect(screen.getByText("Total Completions")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 completed
    expect(screen.getByText("50%")).toBeInTheDocument(); // 1 of 2 on-time
    expect(screen.getByText("2 / 3")).toBeInTheDocument(); // 2 of 3 breakdown
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it("renders Total Focus Duration when focus sessions are present", () => {
    const occurrences = [
      occ("2026-06-04", true, "2026-06-04"),
      occ("2026-06-11", true, "2026-06-11"),
    ];

    render(
      <TaskOverviewCards
        occurrences={occurrences}
        totalFocusDuration={5400} // 1 hour 30 minutes
      />,
    );

    expect(screen.getByText("Total Focus Duration")).toBeInTheDocument();
    expect(screen.getByText("1h 30m")).toBeInTheDocument();
    expect(screen.queryByText("Completion Breakdown")).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});
