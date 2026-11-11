import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HabitScoreChart } from "@/components/habits/insights/HabitScoreChart";
import * as useIsMobileModule from "@/lib/hooks/useIsMobile";
import * as useHapticModule from "@/lib/hooks/useHaptic";
import type { Habit, HabitEntry } from "@/lib/types/habit";

vi.mock("@/lib/hooks/useIsMobile");
vi.mock("@/lib/hooks/useHaptic");

vi.mock("recharts", () => ({
  AreaChart: ({
    children,
    onMouseMove,
    onTouchStart,
    onTouchMove,
    onMouseLeave,
    onTouchEnd,
  }: {
    children: React.ReactNode;
    onMouseMove?: (state: { activeTooltipIndex?: number }) => void;
    onTouchStart?: (state: { activeTooltipIndex?: number }) => void;
    onTouchMove?: (state: { activeTooltipIndex?: number }) => void;
    onMouseLeave?: () => void;
    onTouchEnd?: () => void;
  }) => (
    <svg
      data-testid="area-chart"
      onMouseMove={() => onMouseMove?.({ activeTooltipIndex: 0 })}
      onTouchStart={() => onTouchStart?.({ activeTooltipIndex: 0 })}
      onTouchMove={() => onTouchMove?.({ activeTooltipIndex: 0 })}
      onMouseLeave={onMouseLeave}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </svg>
  ),
  Area: ({
    fill,
    stroke,
    dataKey,
  }: {
    fill?: string;
    stroke?: string;
    dataKey?: string;
  }) => (
    <div
      data-testid="area"
      data-fill={fill}
      data-stroke={stroke}
      data-key={dataKey}
    />
  ),
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: ({ content }: { content?: unknown }) => (
    <div
      data-testid="chart-tooltip"
      data-has-null-content={
        typeof content === "function" && (content as () => unknown)() === null
      }
    />
  ),
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
  const triggerMock = vi.fn();

  beforeEach(() => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
    vi.mocked(useHapticModule.useHaptic).mockReturnValue({
      trigger: triggerMock,
      isPhone: true,
      hapticsEnabled: true,
    });
    triggerMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("renders period toggle with card-variant tabs (variant='card' size='xs')", () => {
    const entries = [entry("2026-06-10", 1)];
    render(<HabitScoreChart habit={dailyHabit} entries={entries} />);

    const tabList = screen.getByRole("tablist");
    expect(tabList).toHaveClass("h-7", "sm:h-8", "bg-secondary/20");

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

  it("tints the chart line and area gradient with habit.color", () => {
    const entries = [entry("2026-06-10", 1)];
    const { container } = render(
      <HabitScoreChart habit={dailyHabit} entries={entries} />,
    );

    const gradient = container.querySelector(`#scoreGradient-${dailyHabit.id}`);
    expect(gradient).toBeInTheDocument();

    const stops = gradient?.querySelectorAll("stop");
    expect(stops?.[0]).toHaveAttribute("stop-color", dailyHabit.color);
    expect(stops?.[1]).toHaveAttribute("stop-color", dailyHabit.color);

    const area = screen.getByTestId("area");
    expect(area).toHaveAttribute("data-stroke", dailyHabit.color);
    expect(area).toHaveAttribute(
      "data-fill",
      `url(#scoreGradient-${dailyHabit.id})`,
    );
  });

  it("suppresses the floating Recharts tooltip", () => {
    const entries = [entry("2026-06-10", 1)];
    render(<HabitScoreChart habit={dailyHabit} entries={entries} />);

    const tooltip = screen.getByTestId("chart-tooltip");
    expect(tooltip).toHaveAttribute("data-has-null-content", "true");
  });

  it("updates pinned header readout during scrubbing and reverts after 2.5s", () => {
    vi.useFakeTimers();
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    render(<HabitScoreChart habit={dailyHabit} entries={entries} />);

    expect(screen.queryByTestId("score-chart-readout")).not.toBeInTheDocument();

    // Trigger scrub move
    const chart = screen.getByTestId("area-chart");
    fireEvent.mouseMove(chart);

    const readout = screen.getByTestId("score-chart-readout");
    expect(readout).toBeInTheDocument();
    expect(readout).toHaveTextContent(/Score/);

    // Trigger mouse leave / touch end
    fireEvent.mouseLeave(chart);

    // Fast forward 1000ms - should still be visible
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("score-chart-readout")).toBeInTheDocument();

    // Fast forward another 1500ms (total 2500ms)
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByTestId("score-chart-readout")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("triggers haptic tick feedback on mobile touch scrubbing", () => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(true);
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    render(<HabitScoreChart habit={dailyHabit} entries={entries} />);

    const chart = screen.getByTestId("area-chart");
    fireEvent.touchStart(chart);

    expect(triggerMock).toHaveBeenCalledWith("tick");
    triggerMock.mockClear();

    fireEvent.touchMove(chart);
    expect(screen.getByTestId("score-chart-readout")).toBeInTheDocument();
  });

  it("does not trigger haptic feedback on desktop mouse move", () => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
    const entries = [
      entry("2026-06-08", 1),
      entry("2026-06-09", 1),
      entry("2026-06-10", 1),
    ];
    render(<HabitScoreChart habit={dailyHabit} entries={entries} />);

    const chart = screen.getByTestId("area-chart");
    fireEvent.mouseMove(chart);

    expect(triggerMock).not.toHaveBeenCalled();
  });
});
