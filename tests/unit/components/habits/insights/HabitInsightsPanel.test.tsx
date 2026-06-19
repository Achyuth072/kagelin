import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HabitInsightsPanel } from "@/components/habits/HabitInsightsPanel";
import type { Habit } from "@/lib/types/habit";
import * as useHabitsModule from "@/lib/hooks/useHabits";

vi.mock("@/lib/hooks/useHabits");
vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("recharts", () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockHabit: Habit = {
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

describe("HabitInsightsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while fetching", () => {
    vi.mocked(useHabitsModule.useHabit).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useHabitsModule.useHabit>);

    render(<HabitInsightsPanel habit={mockHabit} />);

    // Skeleton pulses
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });

  it("shows empty state when entries are empty", () => {
    vi.mocked(useHabitsModule.useHabit).mockReturnValue({
      data: { ...mockHabit, entries: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof useHabitsModule.useHabit>);

    render(<HabitInsightsPanel habit={mockHabit} />);

    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("renders all 5 cards with entries", () => {
    vi.mocked(useHabitsModule.useHabit).mockReturnValue({
      data: {
        ...mockHabit,
        entries: [
          {
            id: "e1",
            habit_id: "h1",
            date: "2026-06-10",
            value: 1,
            created_at: "2026-06-10T00:00:00.000Z",
          },
        ],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useHabitsModule.useHabit>);

    render(<HabitInsightsPanel habit={mockHabit} />);

    // Overview cards (Score appears twice: MetricCard + section title)
    expect(screen.getAllByText("Score")).toHaveLength(2);
    expect(screen.getByText("Current Streak")).toBeInTheDocument();
    expect(screen.getByText("Best Streak")).toBeInTheDocument();
    expect(screen.getByText("Total Completions")).toBeInTheDocument();

    // Section cards
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Best Streaks")).toBeInTheDocument();
    expect(screen.getByText("Frequency")).toBeInTheDocument();

    // Chart renders
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });
});
