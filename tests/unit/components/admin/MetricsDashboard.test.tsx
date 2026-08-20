import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MetricsDashboard } from "@/components/admin/MetricsDashboard";
import type { AdminMetricsSummary } from "@/lib/admin/metricsQueries";

vi.mock("recharts", () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockSummaryWithData: AdminMetricsSummary = {
  kpis: {
    activeDevicesToday: 15,
    activeDevices7d: 45,
    activeDevices30d: 120,
    pwaRatioPercent: 68,
    totalPwaDevices: 68,
    totalBrowserDevices: 32,
    totalPwaInstalls: 14,
    totalFocusHours: 85.5,
    focusHoursToday: 6.2,
    totalTasksCreated: 250,
    totalTasksCompleted: 200,
    taskCompletionRatePercent: 80,
    timerCompletionRatePercent: 92,
    totalTimerCompleted: 110,
    totalTimerAbandoned: 10,
    totalHabitsLogged: 340,
    totalSignups: 28,
  },
  dailyTrends: [
    {
      date: "2026-08-18",
      activeDevices: 12,
      pwaDevices: 8,
      browserDevices: 4,
      tasksCreated: 30,
      tasksCompleted: 25,
      focusHours: 10,
      habitsLogged: 40,
      signups: 3,
    },
    {
      date: "2026-08-19",
      activeDevices: 14,
      pwaDevices: 10,
      browserDevices: 4,
      tasksCreated: 35,
      tasksCompleted: 30,
      focusHours: 12,
      habitsLogged: 45,
      signups: 4,
    },
    {
      date: "2026-08-20",
      activeDevices: 15,
      pwaDevices: 11,
      browserDevices: 4,
      tasksCreated: 20,
      tasksCompleted: 18,
      focusHours: 6.2,
      habitsLogged: 20,
      signups: 2,
    },
  ],
  hasData: true,
  generatedAt: "2026-08-20T12:00:00.000Z",
};

const mockEmptySummary: AdminMetricsSummary = {
  kpis: {
    activeDevicesToday: 0,
    activeDevices7d: 0,
    activeDevices30d: 0,
    pwaRatioPercent: 0,
    totalPwaDevices: 0,
    totalBrowserDevices: 0,
    totalPwaInstalls: 0,
    totalFocusHours: 0,
    focusHoursToday: 0,
    totalTasksCreated: 0,
    totalTasksCompleted: 0,
    taskCompletionRatePercent: 0,
    timerCompletionRatePercent: 0,
    totalTimerCompleted: 0,
    totalTimerAbandoned: 0,
    totalHabitsLogged: 0,
    totalSignups: 0,
  },
  dailyTrends: [],
  hasData: false,
  generatedAt: "2026-08-20T12:00:00.000Z",
};

describe("MetricsDashboard Component", () => {
  it("renders empty state when hasData is false", () => {
    render(<MetricsDashboard summary={mockEmptySummary} />);

    expect(screen.getByText("No telemetry recorded yet")).toBeInTheDocument();
    expect(screen.queryByTestId("area-chart")).not.toBeInTheDocument();
    expect(screen.queryByTestId("composed-chart")).not.toBeInTheDocument();
  });

  it("renders all KPI cards and charts when summary has data", () => {
    render(
      <MetricsDashboard
        summary={mockSummaryWithData}
        adminEmail="admin@kagelin.app"
      />,
    );

    // Header & Admin badge
    expect(screen.getByText("Operator Metrics")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("admin@kagelin.app")).toBeInTheDocument();

    // KPI values
    expect(screen.getByText("15")).toBeInTheDocument(); // activeDevicesToday
    expect(screen.getByText("68%")).toBeInTheDocument(); // pwaRatioPercent
    expect(screen.getByText("85.5h")).toBeInTheDocument(); // totalFocusHours
    expect(screen.getByText("200")).toBeInTheDocument(); // totalTasksCompleted
    expect(screen.getByText("92%")).toBeInTheDocument(); // timerCompletionRatePercent
    expect(screen.getByText("28")).toBeInTheDocument(); // totalSignups

    // Charts
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
  });

  it("allows switching time range tabs", () => {
    render(<MetricsDashboard summary={mockSummaryWithData} />);

    const weekTab = screen.getByRole("tab", { name: "7 Days" });
    const monthTab = screen.getByRole("tab", { name: "30 Days" });
    const allTab = screen.getByRole("tab", { name: "All History" });

    expect(weekTab).toBeInTheDocument();
    expect(monthTab).toBeInTheDocument();
    expect(allTab).toBeInTheDocument();

    expect(monthTab).toHaveAttribute("data-state", "active");

    fireEvent.mouseDown(weekTab);
    expect(weekTab).toHaveAttribute("data-state", "active");
  });
});
