import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { format, subDays } from "date-fns";
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

const measurableHabit: Habit = {
  id: "h2",
  user_id: "u1",
  name: "Running",
  description: null,
  color: "#3b82f6",
  icon: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  archived_at: null,
  start_date: null,
  sort_order: 0,
  habit_type: "measurable",
  target_type: "at_least",
  target_value: 5,
  unit: "km",
  frequency_count: 1,
  frequency_period: "day",
};

describe("HabitOverviewCards", () => {
  it("renders four metric cards with correct labels for boolean habits", () => {
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
    const todayStr = new Date().toISOString().split("T")[0];
    const entries = [entry(todayStr, 1)];
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

  it("suppresses trend deltas when habit has fewer than 14 days of history", () => {
    const today = new Date();
    // Only 5 days of history
    const entries = [
      entry(format(subDays(today, 4), "yyyy-MM-dd"), 1),
      entry(format(today, "yyyy-MM-dd"), 1),
    ];
    render(<HabitOverviewCards habit={dailyHabit} entries={entries} />);

    // No trend badges (role="img") should be rendered
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders trend deltas for Score and Current Streak when history >= 14 days", () => {
    const today = new Date();
    const entries: HabitEntry[] = [];
    // 20 days ago entry to establish history
    entries.push(entry(format(subDays(today, 20), "yyyy-MM-dd"), 1));
    // Consecutive completions in last 5 days
    for (let i = 4; i >= 0; i--) {
      entries.push(entry(format(subDays(today, i), "yyyy-MM-dd"), 1));
    }

    render(<HabitOverviewCards habit={dailyHabit} entries={entries} />);

    // Both Score and Current Streak have trend badges (role="img")
    const trendBadges = screen.getAllByRole("img");
    expect(trendBadges.length).toBe(2);
  });

  it("renders 4 balanced overview cards for measurable habits with target", () => {
    const today = new Date();
    const entries = [
      entry(format(subDays(today, 2), "yyyy-MM-dd"), 6), // met
      entry(format(subDays(today, 1), "yyyy-MM-dd"), 4), // not met
      entry(format(today, "yyyy-MM-dd"), 10), // met
    ];

    render(<HabitOverviewCards habit={measurableHabit} entries={entries} />);

    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("Target Met Rate")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument(); // 2 of 3 met = 67%
    expect(screen.getByText("30-Day Average")).toBeInTheDocument();
    expect(screen.getByText("0.7 km")).toBeInTheDocument(); // 20 / 30 = 0.67 -> 0.7 km
    expect(screen.getByText("Total Volume")).toBeInTheDocument();
    expect(screen.getByText("20 km")).toBeInTheDocument(); // 6 + 4 + 10 = 20 km
  });

  it("renders Days Logged card when measurable habit has no target", () => {
    const noTargetHabit: Habit = {
      ...measurableHabit,
      target_value: null,
    };
    const today = new Date();
    const entries = [
      entry(format(subDays(today, 2), "yyyy-MM-dd"), 6),
      entry(format(today, "yyyy-MM-dd"), 10),
    ];

    render(<HabitOverviewCards habit={noTargetHabit} entries={entries} />);

    expect(screen.getByText("Days Logged")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
