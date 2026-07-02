import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitBestStreaksCard } from "@/components/habits/insights/HabitBestStreaksCard";
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

describe("HabitBestStreaksCard", () => {
  it("shows empty state with no entries", () => {
    render(<HabitBestStreaksCard habit={dailyHabit} entries={[]} />);

    expect(screen.getByText("No streaks yet")).toBeInTheDocument();
  });

  it("renders streak bars with entries", () => {
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-02", 1),
      entry("2026-06-03", 1),
      entry("2026-06-05", 1),
      entry("2026-06-06", 1),
    ];
    render(<HabitBestStreaksCard habit={dailyHabit} entries={entries} />);

    // Should show streak lengths as text
    expect(screen.getByText("3 days")).toBeInTheDocument();
    expect(screen.getByText("2 days")).toBeInTheDocument();
  });

  it("renders bars with correct width ratio", () => {
    const entries = [
      entry("2026-06-01", 1),
      entry("2026-06-02", 1),
      entry("2026-06-03", 1),
    ];
    const { container } = render(
      <HabitBestStreaksCard habit={dailyHabit} entries={entries} />,
    );

    // Should have a single bar at 100% width
    const bar = container.querySelector('[style*="width: 100%"]');
    expect(bar).toBeTruthy();
  });
});
