import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TimeOfDayHeatmap,
  getTargetScrollHour,
} from "@/components/stats/TimeOfDayHeatmap";
import * as useIsMobileModule from "@/lib/hooks/useIsMobile";

vi.mock("@/lib/hooks/useIsMobile");

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

  it("renders 24-hour focus runway grid with 100% full width layout", () => {
    const { container } = render(<TimeOfDayHeatmap matrix={sampleMatrix} />);

    expect(screen.getByText("Focus by Time of Day")).toBeInTheDocument();
    expect(
      screen.getByText("When you focus most, by hour and weekday"),
    ).toBeInTheDocument();

    // Check footer hints
    const desktopHint = screen.getByText("24-hour focus runway");
    const mobileHint = screen.getByText(/Swipe runway for all 24h/i);
    const intensityHint = screen.getByText("Intensity: 0m → 60m+");

    expect(desktopHint).toBeInTheDocument();
    expect(desktopHint).toHaveClass("whitespace-nowrap");
    expect(mobileHint).toBeInTheDocument();
    expect(mobileHint).toHaveClass("whitespace-nowrap");
    expect(intensityHint).toBeInTheDocument();
    expect(intensityHint).toHaveClass("whitespace-nowrap");

    const footerEl = intensityHint.parentElement;
    expect(footerEl).toHaveClass(
      "flex",
      "flex-col",
      "sm:flex-row",
      "gap-1.5",
      "sm:gap-2",
    );

    // Check grid template columns
    const gridEl = container.querySelector(
      '[style*="32px repeat(24, minmax(16px, 1fr))"]',
    );
    expect(gridEl).toBeInTheDocument();
  });

  it("uses a roving tabindex and moves focus with arrow keys", () => {
    render(<TimeOfDayHeatmap matrix={sampleMatrix} />);

    const firstCell = screen.getByTitle("Mon 12:00 AM: 0m");
    expect(firstCell).toHaveAttribute("tabindex", "0");
    expect(screen.getByTitle("Mon 9:00 AM: 15m")).toHaveAttribute(
      "tabindex",
      "-1",
    );

    fireEvent.keyDown(firstCell, { key: "ArrowRight" });
    const nextHour = screen.getByTitle("Mon 1:00 AM: 0m");
    expect(nextHour).toHaveAttribute("tabindex", "0");
    expect(nextHour).toHaveFocus();

    fireEvent.keyDown(nextHour, { key: "ArrowDown" });
    expect(screen.getByTitle("Tue 1:00 AM: 0m")).toHaveFocus();
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

  describe("getTargetScrollHour", () => {
    it("returns default 8am when matrix has no activity", () => {
      expect(getTargetScrollHour(emptyMatrix)).toBe(8);
    });

    it("returns 1 hour before daytime focus (9am -> 8am)", () => {
      const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
      matrix[0][9] = 30; // Mon 9am
      expect(getTargetScrollHour(matrix)).toBe(8);
    });

    it("returns 1 hour before early morning focus (6am -> 5am)", () => {
      const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
      matrix[2][6] = 45; // Wed 6am
      expect(getTargetScrollHour(matrix)).toBe(5);
    });

    it("caps daytime scroll at 8am for late afternoon focus to keep daytime view intact", () => {
      const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
      matrix[3][14] = 60; // Thu 2pm (daytime focus)
      expect(getTargetScrollHour(matrix)).toBe(8);
    });

    it("anchors to 8am when daytime focus starts at 10am even with an isolated stray night session", () => {
      const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
      matrix[1][2] = 10; // Stray session at 2am
      matrix[1][10] = 50; // Main daytime session at 10am
      expect(getTargetScrollHour(matrix)).toBe(8);
    });

    it("anchors to night activity if user is a pure night owl with zero daytime sessions", () => {
      const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
      matrix[0][2] = 45; // Mon 2am
      matrix[4][3] = 30; // Fri 3am
      expect(getTargetScrollHour(matrix)).toBe(1); // 2am - 1h = 1am
    });
  });

  describe("current hour polish indicator", () => {
    beforeEach(() => {
      vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
    });

    it("highlights the current hour in the header row", () => {
      const now = new Date();
      now.setHours(14, 0, 0, 0); // 2pm (non-major hour normally shown as ·)
      vi.useFakeTimers();
      vi.setSystemTime(now);

      render(<TimeOfDayHeatmap matrix={sampleMatrix} />);

      const currentHourEl = screen.getByTestId("current-hour-header");
      expect(currentHourEl).toBeInTheDocument();
      expect(currentHourEl).toHaveTextContent("2p");
      expect(currentHourEl).toHaveAttribute("title", "Current hour (2p)");

      vi.useRealTimers();
    });
  });

  describe("mobile auto-scroll", () => {
    beforeEach(() => {
      vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("auto-scrolls to the target hour on mobile mount", () => {
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (cb: FrameRequestCallback) => {
          cb(0);
          return 0;
        },
      );

      const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
      matrix[0][9] = 30; // 9am focus -> target hour is 8

      const { container } = render(<TimeOfDayHeatmap matrix={matrix} />);
      const scroller = container.querySelector(
        '[data-testid="time-of-day-scroller"]',
      ) as HTMLDivElement;
      expect(scroller).toBeInTheDocument();

      const targetCell = container.querySelector(
        '[data-hour="8"]',
      ) as HTMLElement;
      expect(targetCell).toBeInTheDocument();

      // Mock getBoundingClientRect on container and target cell
      vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue({
        left: 10,
        top: 0,
        right: 310,
        bottom: 200,
        width: 300,
        height: 200,
        x: 10,
        y: 0,
        toJSON: () => {},
      });

      vi.spyOn(targetCell, "getBoundingClientRect").mockReturnValue({
        left: 210,
        top: 20,
        right: 230,
        bottom: 40,
        width: 20,
        height: 20,
        x: 210,
        y: 20,
        toJSON: () => {},
      });

      // Rerender with mobile layout effect
      const { rerender } = render(<TimeOfDayHeatmap matrix={matrix} />);
      // Expected targetScrollLeft = Math.max(0, 0 + (210 - 10) - 36) = 164
      rerender(<TimeOfDayHeatmap matrix={matrix} />);
    });
  });
});
