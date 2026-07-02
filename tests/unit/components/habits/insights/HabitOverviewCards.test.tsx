import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitOverviewCards } from "@/components/habits/insights/HabitOverviewCards";
import type { Habit, HabitEntry } from "@/lib/types/habit";

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

function entry(date: string, value: number): HabitEntry {
  return {
    id: `e-${date}`,
    habit_id: "h1",
    date,
    value,
    created_at: `${date}T00:00:00.000Z`,
  };
}

const dailyHabit: Habit = {
  id: "h1",
  user_id: "u1",
  name: "Exercise",
  description: null,
  color: "#10b981",
  icon: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  archived_at: null,
  start_date: null,
  sort_order: 0,
  habit_type: "boolean",
  frequency_count: 1,
  frequency_period: "day",
};

describe("HabitOverviewCards", () => {
  it("renders four metric cards with correct labels", () => {
    render(<HabitOverviewCards habit={dailyHabit} entries={[]} />);

    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("Current Streak")).toBeInTheDocument();
    expect(screen.getByText("Best Streak")).toBeInTheDocument();
    expect(screen.getByText("Total Completions")).toBeInTheDocument();
  });

  it("shows 0% score and 0 days with no entries", () => {
    render(<HabitOverviewCards habit={dailyHabit} entries={[]} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getAllByText("0 days")).toHaveLength(2);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows non-zero score with entries", () => {
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    render(<HabitOverviewCards habit={dailyHabit} entries={entries} />);

    // Score should be > 0%
    const scoreEl = screen.getByText(/%/);
    const scoreVal = parseInt(scoreEl.textContent!);
    expect(scoreVal).toBeGreaterThan(0);
  });

  it("shows total completions count", () => {
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    render(<HabitOverviewCards habit={dailyHabit} entries={entries} />);

    // Total completions for daily boolean = 3
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
