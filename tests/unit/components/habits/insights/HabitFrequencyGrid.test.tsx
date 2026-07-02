import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitFrequencyGrid } from "@/components/habits/insights/HabitFrequencyGrid";
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

describe("HabitFrequencyGrid", () => {
  it("shows empty state with no entries", () => {
    render(<HabitFrequencyGrid habit={dailyHabit} entries={[]} />);

    expect(screen.getByText("No frequency data")).toBeInTheDocument();
  });

  it("renders weekday labels", () => {
    const entries = [entry("2026-06-10", 1)];
    render(<HabitFrequencyGrid habit={dailyHabit} entries={entries} />);

    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("Thu")).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
    expect(screen.getByText("Sun")).toBeInTheDocument();
  });

  it("renders month abbreviation headers", () => {
    const entries = [entry("2026-06-10", 1)];
    render(<HabitFrequencyGrid habit={dailyHabit} entries={entries} />);

    // Should have month headers (at least the current month)
    expect(screen.getByText("Jun")).toBeInTheDocument();
  });

  it("renders bubble dots for entries", () => {
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    const { container } = render(
      <HabitFrequencyGrid habit={dailyHabit} entries={entries} />,
    );

    // Should render rounded-full divs (bubbles)
    const bubbles = container.querySelectorAll(".rounded-full");
    expect(bubbles.length).toBeGreaterThan(0);
  });
});
