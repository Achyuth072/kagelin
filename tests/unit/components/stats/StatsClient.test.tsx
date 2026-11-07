import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StatsClient } from "@/components/stats/StatsClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn((selector) =>
    selector({
      statsPeriod: "7d",
      setStatsPeriod: vi.fn(),
    }),
  ),
}));

vi.mock("@/lib/hooks/useStats", () => ({
  useStats: () => ({
    data: {
      totalFocusHours: 24.5,
      totalSessions: 16,
      tasksCompleted: 38,
      currentStreak: 18,
      completionRate: 84,
      habitReps: 42,
      trends: {
        focus: { value: 12.4, isPositive: true },
        tasks: { value: 4.2, isPositive: false },
        rate: { value: 5.1, isPositive: true },
        habitReps: { value: 8.0, isPositive: true },
      },
      dailyTrend: [{ date: "2026-11-01", hours: 2, tasksCompleted: 3 }],
      timeOfDay: Array.from({ length: 7 }, () => Array(24).fill(0)),
      byProject: [],
      byPriority: [],
    },
    isLoading: false,
    isFetching: false,
  }),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => ({ data: [{ id: "t1" }], isLoading: false }),
}));

vi.mock("@/lib/hooks/useHabits", () => ({
  useHabits: () => ({
    data: [
      {
        id: "h1",
        name: "Habit 1",
        color: "#3b82f6",
        entries: [],
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/lib/hooks/useHeatmapData", () => ({
  useHeatmapData: () => ({ activeDays: 20, isLoading: false }),
}));

// Mock dynamic imports to keep test fast and focused
vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockDynamicComponent() {
      return <div data-testid="dynamic-mock" />;
    };
  },
}));

describe("StatsClient", () => {
  it("renders the 6 core production metric cards in responsive grid", () => {
    const { container } = render(<StatsClient />);

    // 6 Metrics
    expect(screen.getByText("Total Focus")).toBeInTheDocument();
    expect(screen.getByText("24.5h")).toBeInTheDocument();

    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("16")).toBeInTheDocument();

    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();

    expect(screen.getByText("Streak")).toBeInTheDocument();
    expect(screen.getByText("18d")).toBeInTheDocument();

    expect(screen.getByText("Rate")).toBeInTheDocument();
    expect(screen.getByText("84%")).toBeInTheDocument();

    expect(screen.getByText("Habits")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();

    // Verify grid layout class
    const grid = container.querySelector(
      ".grid-cols-2.md\\:grid-cols-3.xl\\:grid-cols-6",
    );
    expect(grid).toBeInTheDocument();
  });
});
