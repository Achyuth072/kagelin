import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FocusTrendChart } from "@/components/stats/FocusTrendChart";

vi.mock("@/lib/hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("recharts", () => ({
  ComposedChart: ({
    children,
    onMouseMove,
    onMouseLeave,
  }: {
    children: React.ReactNode;
    onMouseMove?: (state: { activeTooltipIndex?: number }) => void;
    onMouseLeave?: () => void;
  }) => (
    <svg
      data-testid="composed-chart"
      onMouseMove={() =>
        onMouseMove?.({
          activeTooltipIndex: 0,
        })
      }
      onMouseLeave={onMouseLeave}
    >
      {children}
    </svg>
  ),
  Area: ({
    fill,
    yAxisId,
    dataKey,
  }: {
    fill?: string;
    yAxisId?: string;
    dataKey?: string;
  }) => (
    <rect
      data-testid="area-fill"
      data-fill={fill}
      data-yaxis={yAxisId}
      data-key={dataKey}
    />
  ),
  Line: ({
    yAxisId,
    dataKey,
    stroke,
    strokeDasharray,
  }: {
    yAxisId?: string;
    dataKey?: string;
    stroke?: string;
    strokeDasharray?: string;
  }) => (
    <path
      data-testid={`line-${dataKey}`}
      data-stroke={stroke}
      data-yaxis={yAxisId}
      data-dashed={strokeDasharray}
    />
  ),
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("FocusTrendChart", () => {
  const sampleData = [
    { date: "2026-11-01", hours: 2.5, tasksCompleted: 4 },
    { date: "2026-11-02", hours: 4.0, tasksCompleted: 6 },
    { date: "2026-11-03", hours: 1.5, tasksCompleted: 2 },
  ];

  it("renders empty state when there is no activity", () => {
    const emptyData = [
      { date: "2026-11-01", hours: 0, tasksCompleted: 0 },
      { date: "2026-11-02", hours: 0, tasksCompleted: 0 },
    ];

    render(<FocusTrendChart data={emptyData} />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete a focus session or task to see your trend here.",
      ),
    ).toBeInTheDocument();
  });

  it("renders accessible screen-reader summary table for data points", () => {
    render(
      <FocusTrendChart
        data={sampleData}
        periodLabel="Last 7 days (ends today)"
      />,
    );

    expect(
      screen.getByText("Last 7 days (ends today) focus and task trend"),
    ).toBeInTheDocument();

    const table = screen.getByRole("table", { hidden: true });
    expect(table).toHaveClass("sr-only");
    expect(table.parentElement).toHaveClass("sr-only");
    expect(
      screen.getByText("Last 7 days (ends today) Focus and Task Trend Summary"),
    ).toHaveClass("sr-only");

    expect(screen.getByText("2.5 hours")).toBeInTheDocument();
    expect(screen.getByText("4 tasks")).toBeInTheDocument();
    expect(screen.getByText("4 hours")).toBeInTheDocument();
    expect(screen.getByText("6 tasks")).toBeInTheDocument();
  });

  it("renders dual continuous series with gradient fill and dashed task line", () => {
    const { container } = render(
      <FocusTrendChart data={sampleData} periodLabel="Last 7 days" />,
    );

    const card = container.querySelector(".p-4.sm\\:p-6");
    expect(card).toBeInTheDocument();

    // Gradient in defs
    const gradient = container.querySelector("#focusGradient");
    expect(gradient).toBeInTheDocument();

    // Area fill with focus gradient
    const area = screen.getByTestId("area-fill");
    expect(area).toHaveAttribute("data-fill", "url(#focusGradient)");
    expect(area).toHaveAttribute("data-yaxis", "hours");

    // Hours solid line
    const hoursLine = screen.getByTestId("line-hours");
    expect(hoursLine).toHaveAttribute("data-stroke", "hsl(var(--brand))");

    // Tasks completed dashed line
    const tasksLine = screen.getByTestId("line-tasksCompleted");
    expect(tasksLine).toHaveAttribute(
      "data-stroke",
      "hsl(var(--muted-foreground))",
    );
    expect(tasksLine).toHaveAttribute("data-dashed", "4 4");
  });

  it("aggregates data by month when period is 1y", () => {
    const multiMonthData = [
      { date: "2026-10-10", hours: 2.0, tasksCompleted: 3 },
      { date: "2026-10-20", hours: 3.0, tasksCompleted: 2 },
      { date: "2026-11-02", hours: 4.0, tasksCompleted: 5 },
    ];

    render(
      <FocusTrendChart
        data={multiMonthData}
        periodLabel="Last year"
        period="1y"
      />,
    );

    // Month totals: Oct = 5h, 5 tasks; Nov = 4h, 5 tasks
    expect(screen.getByText("Oct")).toBeInTheDocument();
    expect(screen.getByText("Nov")).toBeInTheDocument();
    expect(screen.getByText("5 hours")).toBeInTheDocument();
    expect(screen.getAllByText("5 tasks")).toHaveLength(2);
    expect(screen.getByText("4 hours")).toBeInTheDocument();
  });

  it("aggregates data by week when period is 90d", () => {
    const multiWeekData = [
      { date: "2026-10-26", hours: 2.0, tasksCompleted: 2 },
      { date: "2026-10-27", hours: 3.0, tasksCompleted: 1 },
      { date: "2026-11-02", hours: 4.0, tasksCompleted: 5 },
    ];

    render(
      <FocusTrendChart
        data={multiWeekData}
        periodLabel="Last 90 days"
        period="90d"
      />,
    );

    // Week 1 (Oct 26): 5h, 3 tasks; Week 2 (Nov 2): 4h, 5 tasks
    expect(screen.getByText("5 hours")).toBeInTheDocument();
    expect(screen.getByText("3 tasks")).toBeInTheDocument();
    expect(screen.getByText("4 hours")).toBeInTheDocument();
    expect(screen.getByText("5 tasks")).toBeInTheDocument();
  });

  it("updates header readout during scrubbing and reverts after timeout", () => {
    vi.useFakeTimers();

    render(
      <FocusTrendChart
        data={sampleData}
        periodLabel="Last 7 days"
        period="7d"
      />,
    );

    // Default resting header
    expect(
      screen.getByText("Last 7 days focus and task trend"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("scrub-readout")).not.toBeInTheDocument();

    // Trigger mouse move / scrub
    const chart = screen.getByTestId("composed-chart");
    fireEvent.mouseMove(chart);

    // Scrub readout becomes visible
    expect(screen.getByTestId("scrub-readout")).toBeInTheDocument();
    expect(screen.getByText("Sun, Nov 1, 2026:")).toBeInTheDocument();
    expect(screen.getByText("2.5h")).toBeInTheDocument();

    // Trigger mouse leave / touch end
    fireEvent.mouseLeave(chart);

    // Fast-forward 1500ms
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Reverts back to default resting header
    expect(screen.queryByTestId("scrub-readout")).not.toBeInTheDocument();
    expect(
      screen.getByText("Last 7 days focus and task trend"),
    ).toBeInTheDocument();

    vi.useRealTimers();
  });
});
