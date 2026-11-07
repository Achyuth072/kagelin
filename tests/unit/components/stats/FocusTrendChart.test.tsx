import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FocusTrendChart } from "@/components/stats/FocusTrendChart";

vi.mock("@/lib/hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("recharts", () => ({
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <svg data-testid="composed-chart">{children}</svg>
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

    const table = screen.getByRole("table", { hidden: true });
    expect(table).toHaveClass("sr-only");

    expect(screen.getByText("2.5 hours")).toBeInTheDocument();
    expect(screen.getByText("4 tasks")).toBeInTheDocument();
    expect(screen.getByText("4 hours")).toBeInTheDocument();
    expect(screen.getByText("6 tasks")).toBeInTheDocument();
  });

  it("renders dual continuous series with gradient fill and dashed task line", () => {
    const { container } = render(
      <FocusTrendChart data={sampleData} periodLabel="Last 7 days" />,
    );

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
});
