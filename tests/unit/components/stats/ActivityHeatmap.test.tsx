import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ActivityHeatmap } from "@/components/stats/ActivityHeatmap";

vi.mock("@/lib/hooks/useHeatmapData", () => ({
  useHeatmapData: () => ({
    data: [
      { date: "2026-11-01", focus: 2.5, tasks: 4, combined: 6.5 },
      { date: "2026-11-02", focus: 0, tasks: 0, combined: 0 },
    ],
    isLoading: false,
    maxValue: { focus: 4, tasks: 6, combined: 10 },
    activeDays: 142,
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "dark",
  }),
}));

vi.mock("@/lib/hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/lib/hooks/useHorizontalScroll", () => ({
  useHorizontalScroll: () => () => {},
}));

describe("ActivityHeatmap", () => {
  it("renders active days count and activity calendar heading", () => {
    render(<ActivityHeatmap />);
    expect(screen.getByText("Activity Heatmap")).toBeInTheDocument();
    expect(
      screen.getByText("142 active days in the past year"),
    ).toBeInTheDocument();
  });

  it("does not use hardcoded hex values (#262626 or #ebebeb) in theme definitions", () => {
    const { container } = render(<ActivityHeatmap />);
    const html = container.innerHTML;
    expect(html).not.toContain("#262626");
    expect(html).not.toContain("#ebebeb");
  });

  it("provides accessible keyboard cell inspection", () => {
    render(<ActivityHeatmap />);
    const cellButtons = screen.getAllByRole("button");
    expect(cellButtons.length).toBeGreaterThan(0);
    expect(cellButtons[0]).toHaveAttribute("tabindex", "0");
  });
});
