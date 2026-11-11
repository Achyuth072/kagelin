import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HabitFrequencyGrid } from "@/components/habits/insights/HabitFrequencyGrid";
import * as useIsMobileModule from "@/lib/hooks/useIsMobile";
import type { Habit, HabitEntry } from "@/lib/types/habit";

vi.mock("@/lib/hooks/useIsMobile");

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
  beforeEach(() => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("wraps the frequency grid in a tactile card container", () => {
    const entries = [entry("2026-06-10", 1)];
    render(<HabitFrequencyGrid habit={dailyHabit} entries={entries} />);

    const card = screen.getByTestId("frequency-grid-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass("rounded-xl", "border", "bg-card");
  });

  it("provides sticky weekday column for horizontal scrolling", () => {
    const entries = [entry("2026-06-10", 1)];
    render(<HabitFrequencyGrid habit={dailyHabit} entries={entries} />);

    const monLabel = screen.getByText("Mon");
    expect(monLabel).toHaveClass("sticky", "left-0", "bg-card", "z-10");
  });

  it("auto-scrolls to the current/recent months on mobile mount", () => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(true);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      },
    );

    const originalScrollWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollWidth",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      value: 500,
    });

    try {
      const entries = [entry("2026-06-10", 1)];
      const { rerender } = render(
        <HabitFrequencyGrid habit={dailyHabit} entries={entries} />,
      );

      const scroller = screen.getByTestId("frequency-grid-scroller");
      expect(scroller).toBeInTheDocument();
      expect(scroller.scrollLeft).toBe(500);

      // Switching habits re-triggers auto-scroll
      const otherHabit = { ...dailyHabit, id: "h2", name: "Reading" };
      scroller.scrollLeft = 0;
      rerender(<HabitFrequencyGrid habit={otherHabit} entries={entries} />);
      expect(scroller.scrollLeft).toBe(500);
    } finally {
      if (originalScrollWidth) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollWidth",
          originalScrollWidth,
        );
      }
    }
  });
});
