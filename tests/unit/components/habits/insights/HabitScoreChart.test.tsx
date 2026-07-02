import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitScoreChart } from "@/components/habits/insights/HabitScoreChart";
import type { Habit, HabitEntry } from "@/lib/types/habit";

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("recharts", () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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

describe("HabitScoreChart", () => {
  it("shows empty state with no entries", () => {
    render(<HabitScoreChart habit={dailyHabit} entries={[]} />);

    expect(screen.getByText("No score data")).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
  });

  it("renders chart with entries", () => {
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    render(<HabitScoreChart habit={dailyHabit} entries={entries} />);

    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("renders period toggle with Week/Month/Year", () => {
    const entries = [entry("2026-06-10", 1)];
    render(<HabitScoreChart habit={dailyHabit} entries={entries} />);

    expect(screen.getByRole("tab", { name: "Week" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Month" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Year" })).toBeInTheDocument();
  });

  it("defaults to Month period", () => {
    const entries = [entry("2026-06-10", 1)];
    render(<HabitScoreChart habit={dailyHabit} entries={entries} />);

    expect(screen.getByRole("tab", { name: "Month" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches period on toggle click", () => {
    const entries = [entry("2026-06-10", 1)];
    render(<HabitScoreChart habit={dailyHabit} entries={entries} />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Week" }));

    expect(screen.getByRole("tab", { name: "Week" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Month" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });
});
