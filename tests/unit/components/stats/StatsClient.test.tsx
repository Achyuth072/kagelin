import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatsClient } from "@/components/stats/StatsClient";

let mockTasksState = {
  data: [{ id: "t1" }] as Array<{ id: string }> | undefined,
  isLoading: false,
};
let mockHabitsState = {
  data: [
    {
      id: "h1",
      name: "Habit 1",
      color: "#3b82f6",
      entries: [],
    },
  ] as
    Array<{ id: string; name: string; color: string; entries: [] }> | undefined,
  isLoading: false,
};
let mockHeatmapState = { activeDays: 20, isLoading: false };

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
  useTasks: () => mockTasksState,
}));

vi.mock("@/lib/hooks/useHabits", () => ({
  useHabits: () => mockHabitsState,
}));

vi.mock("@/lib/hooks/useHeatmapData", () => ({
  useHeatmapData: () => mockHeatmapState,
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
  beforeEach(() => {
    mockTasksState = { data: [{ id: "t1" }], isLoading: false };
    mockHabitsState = {
      data: [{ id: "h1", name: "Habit 1", color: "#3b82f6", entries: [] }],
      isLoading: false,
    };
    mockHeatmapState = { activeDays: 20, isLoading: false };
  });

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

  it("renders core stats cards immediately while tasks, habits, and heatmap are still loading", () => {
    mockTasksState = { data: undefined, isLoading: true };
    mockHabitsState = { data: undefined, isLoading: true };
    mockHeatmapState = { activeDays: 0, isLoading: true };

    render(<StatsClient />);

    expect(screen.getByText("Total Focus")).toBeInTheDocument();
    expect(screen.getByText("24.5h")).toBeInTheDocument();
    expect(
      screen.queryByText(/start a focus session/i),
    ).not.toBeInTheDocument();
  });
});
