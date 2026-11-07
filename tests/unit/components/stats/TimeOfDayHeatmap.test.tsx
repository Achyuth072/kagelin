import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TimeOfDayHeatmap } from "@/components/stats/TimeOfDayHeatmap";

describe("TimeOfDayHeatmap", () => {
  const emptyMatrix = Array.from({ length: 7 }, () => Array(24).fill(0));

  const sampleMatrix = Array.from({ length: 7 }, (_, dayIdx) =>
    Array.from({ length: 24 }, (_, hour) => {
      if (dayIdx === 0 && hour === 9) return 15; // Mon 9am - level 1 (1-20m)
      if (dayIdx === 1 && hour === 14) return 35; // Tue 2pm - level 2 (21-40m)
      if (dayIdx === 2 && hour === 11) return 55; // Wed 11am - level 3 (41-60m)
      if (dayIdx === 3 && hour === 16) return 90; // Thu 4pm - level 4 (>60m)
      return 0; // level 0 (0m)
    }),
  );

  it("renders empty state when there are no focus sessions in the matrix", () => {
    render(<TimeOfDayHeatmap matrix={emptyMatrix} />);
    expect(screen.getByText("No focus sessions yet")).toBeInTheDocument();
    expect(
      screen.getByText("Complete a focus session to see your patterns here."),
    ).toBeInTheDocument();
  });

  it("renders 24-hour calibrated runway grid with 100% full width layout", () => {
    const { container } = render(<TimeOfDayHeatmap matrix={sampleMatrix} />);

    expect(screen.getByText("Focus by Time of Day")).toBeInTheDocument();
    expect(
      screen.getByText("When you focus most, by hour and weekday"),
    ).toBeInTheDocument();

    // Check footer hints
    expect(
      screen.getByText(/24-hour calibrated runway • 100% full width/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Swipe runway for all 24h/i)).toBeInTheDocument();
    expect(screen.getByText("Intensity: 0m → 60m+")).toBeInTheDocument();

    // Check grid template columns
    const gridEl = container.querySelector(
      '[style*="32px repeat(24, minmax(16px, 1fr))"]',
    );
    expect(gridEl).toBeInTheDocument();
  });

  it("calibrates intensity levels across 0m, 1-20m, 21-40m, 41-60m, >60m", () => {
    render(<TimeOfDayHeatmap matrix={sampleMatrix} />);

    const level0Cell = screen.getByTitle("Mon 12:00 AM: 0m");
    expect(level0Cell).toHaveClass("bg-secondary/40", "border-border/30");

    const level1Cell = screen.getByTitle("Mon 9:00 AM: 15m");
    expect(level1Cell).toHaveClass("bg-brand/20");

    const level2Cell = screen.getByTitle("Tue 2:00 PM: 35m");
    expect(level2Cell).toHaveClass("bg-brand/45");

    const level3Cell = screen.getByTitle("Wed 11:00 AM: 55m");
    expect(level3Cell).toHaveClass("bg-brand/70");

    const level4Cell = screen.getByTitle("Thu 4:00 PM: 90m");
    expect(level4Cell).toHaveClass("bg-brand", "text-white");
  });

  it("updates subtitle with dynamic readout on cell click and resets cleanly on Reset button click", () => {
    render(<TimeOfDayHeatmap matrix={sampleMatrix} />);

    expect(
      screen.getByText("When you focus most, by hour and weekday"),
    ).toBeInTheDocument();
    expect(screen.queryByTitle("Reset selection")).toBeNull();

    // Click Mon 9am cell
    const cell = screen.getByTitle("Mon 9:00 AM: 15m");
    fireEvent.click(cell);

    expect(screen.getByText("Mon at 9:00 AM — 15m focus")).toBeInTheDocument();

    const resetButton = screen.getByTitle("Reset selection");
    expect(resetButton).toBeInTheDocument();

    // Click Reset button
    fireEvent.click(resetButton);

    expect(
      screen.getByText("When you focus most, by hour and weekday"),
    ).toBeInTheDocument();
    expect(screen.queryByTitle("Reset selection")).toBeNull();
  });
});
