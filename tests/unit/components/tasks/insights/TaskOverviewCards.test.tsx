import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TaskOverviewCards } from "@/components/tasks/insights/TaskOverviewCards";
import type { TaskOccurrence } from "@/lib/utils/task-streak";

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
  it("renders all five metric cards with correct labels", () => {
    render(<TaskOverviewCards occurrences={[]} />);

    expect(screen.getByText("Completion Rate")).toBeInTheDocument();
    expect(screen.getByText("On-Time")).toBeInTheDocument();
    expect(screen.getByText("Current Streak")).toBeInTheDocument();
    expect(screen.getByText("Best Streak")).toBeInTheDocument();
    expect(screen.getByText("Total Completions")).toBeInTheDocument();
  });

  it("shows placeholder rates with no decided Occurrences", () => {
    render(<TaskOverviewCards occurrences={[]} />);

    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("computes rates and streaks from a mixed history", () => {
    const occurrences = [
      occ("2026-06-04", true, "2026-06-04"),
      occ("2026-06-11", true, "2026-06-11"),
      occ("2026-06-18", true, "2026-06-18"),
    ];

    render(<TaskOverviewCards occurrences={occurrences} />);

    // completion rate + on-time rate
    expect(screen.getAllByText("100%")).toHaveLength(2);
    // current streak + best streak + total completions
    expect(screen.getAllByText("3")).toHaveLength(3);
  });
});
