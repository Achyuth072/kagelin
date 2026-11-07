import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProjectionsCard } from "@/components/stats/ProjectionsCard";

vi.mock("@/lib/hooks/useHabits", () => ({
  useHabits: () => ({
    data: [
      {
        id: "habit-1",
        name: "Morning Meditation Practice",
        entries: {},
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/lib/hooks/useStats", () => ({
  useStats: () => ({
    data: {
      dailyTrend: [
        { date: "2026-11-01", hours: 2, tasksCompleted: 3 },
        { date: "2026-11-02", hours: 3, tasksCompleted: 4 },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock("@/lib/utils/projections", () => ({
  projectTasksThisMonth: () => ({ soFar: 7, projected: 105 }),
  projectFocusHoursThisMonth: () => ({ soFar: 5, projected: 75 }),
  getStreaksAtRisk: () => [
    {
      habitId: "habit-1",
      name: "Morning Meditation Practice",
      currentStreak: 12,
    },
  ],
}));

describe("ProjectionsCard", () => {
  it("renders projections and streaks at risk with responsive layout", () => {
    const { container } = render(<ProjectionsCard />);

    // Card should use responsive padding
    const card = container.querySelector(".p-4.sm\\:p-6");
    expect(card).toBeInTheDocument();

    // Metrics should be rendered
    expect(screen.getByText("Tasks this month")).toBeInTheDocument();
    expect(screen.getByText("~105")).toBeInTheDocument();
    expect(screen.getByText("Focus this month")).toBeInTheDocument();
    expect(screen.getByText("~75h")).toBeInTheDocument();

    // Progress bar height should be responsive
    const barTrack = container.querySelector(".h-2.sm\\:h-1\\.5");
    expect(barTrack).toBeInTheDocument();

    // Streaks at risk
    expect(screen.getByText("Morning Meditation Practice")).toBeInTheDocument();
    expect(
      screen.getByText(/12d streak — log today to keep it/i),
    ).toBeInTheDocument();

    // Responsive streak row
    const streakItem = container.querySelector("li");
    expect(streakItem).toHaveClass("flex", "flex-col", "sm:flex-row");
  });
});
