import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatsBarList } from "@/components/stats/StatsBarList";

describe("StatsBarList", () => {
  const items = [
    {
      key: "habit-1",
      label: "Meditation Practice",
      displayValue: "85%",
      color: "#10b981",
      ratio: 0.85,
    },
    {
      key: "habit-2",
      label: "Deep Work Session",
      displayValue: "60%",
      color: "#3b82f6",
      ratio: 0.6,
    },
  ];

  it("renders items with mobile-responsive stacked structure and desktop horizontal layout", () => {
    const { container } = render(
      <StatsBarList items={items} labelWidthClassName="w-40 sm:w-56" />,
    );

    expect(screen.getByText("Meditation Practice")).toBeInTheDocument();
    expect(screen.getByText("Deep Work Session")).toBeInTheDocument();
    expect(screen.getAllByText("85%")).toHaveLength(2); // mobile and desktop
    expect(screen.getAllByText("60%")).toHaveLength(2);

    // Each row container should have responsive flex direction
    const rowEl = container.querySelector(".flex.flex-col.sm\\:flex-row");
    expect(rowEl).toBeInTheDocument();

    // Progress bar should have width set according to ratio and responsive track width
    const track = container.querySelector(".w-full.sm\\:w-auto.sm\\:flex-1");
    expect(track).toBeInTheDocument();

    const bars = container.querySelectorAll(".bg-foreground\\/70");
    expect(bars[0]).toHaveStyle({ width: "85%" });
    expect(bars[1]).toHaveStyle({ width: "60%" });
  });
});
