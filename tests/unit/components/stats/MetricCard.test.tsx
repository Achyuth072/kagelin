import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Clock } from "lucide-react";
import { MetricCard } from "@/components/stats/MetricCard";

describe("MetricCard", () => {
  it("renders title, value, and icon", () => {
    render(<MetricCard title="Total Focus" value="24.5h" icon={Clock} />);

    expect(screen.getByText("Total Focus")).toBeInTheDocument();
    expect(screen.getByText("24.5h")).toBeInTheDocument();
  });

  it("renders positive trend badge with Lucide TrendingUp icon and semantic tokens", () => {
    const { container } = render(
      <MetricCard
        title="Total Focus"
        value="24.5h"
        trend={{ value: 12.4, isPositive: true }}
      />,
    );

    const trendBadge = screen.getByRole("img", {
      name: /increased by 12.4% compared to last period/i,
    });
    expect(trendBadge).toBeInTheDocument();
    expect(trendBadge).toHaveClass(
      "text-brand",
      "bg-brand/15",
      "border-brand/20",
    );

    // Must use Lucide icon svg, not unicode arrow
    const lucideIcon = container.querySelector(".lucide-trending-up");
    expect(lucideIcon).toBeInTheDocument();
  });

  it("renders negative trend badge with Lucide TrendingDown icon and destructive tokens", () => {
    const { container } = render(
      <MetricCard
        title="Tasks"
        value="38"
        trend={{ value: 4.2, isPositive: false }}
      />,
    );

    const trendBadge = screen.getByRole("img", {
      name: /decreased by 4.2% compared to last period/i,
    });
    expect(trendBadge).toBeInTheDocument();
    expect(trendBadge).toHaveClass(
      "text-destructive",
      "bg-destructive-surface",
      "border-destructive-surface-border",
    );

    const lucideIcon = container.querySelector(".lucide-trending-down");
    expect(lucideIcon).toBeInTheDocument();
  });

  it("renders without trend badge or artificial blank footer spacers when trend is undefined", () => {
    const { container } = render(<MetricCard title="Sessions" value="16" />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector(".h-6")).toBeNull();
    expect(container.querySelector("[data-spacer]")).toBeNull();
  });

  it("applies tabular-nums to value container to prevent layout shifting", () => {
    const { container } = render(<MetricCard title="Tasks" value="42" />);
    const valueEl = container.querySelector(".tabular-nums");
    expect(valueEl).toBeInTheDocument();
    expect(valueEl).toHaveTextContent("42");
  });
});
