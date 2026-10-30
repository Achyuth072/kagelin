import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PeriodSelector } from "@/components/stats/PeriodSelector";

describe("PeriodSelector Component", () => {
  it("renders all period options and indicates the active period", () => {
    const onValueChange = vi.fn();
    render(<PeriodSelector value="7d" onValueChange={onValueChange} />);

    const activeTab = screen.getByRole("tab", { name: "7D" });
    const inactiveTab = screen.getByRole("tab", { name: "30D" });

    expect(activeTab).toHaveAttribute("data-state", "active");
    expect(inactiveTab).toHaveAttribute("data-state", "inactive");
    expect(activeTab.className).toContain("data-[state=active]:text-brand");
  });

  it("calls onValueChange when a tab is clicked", () => {
    const onValueChange = vi.fn();
    render(<PeriodSelector value="7d" onValueChange={onValueChange} />);

    const monthTab = screen.getByRole("tab", { name: "30D" });
    fireEvent.mouseDown(monthTab);

    expect(onValueChange).toHaveBeenCalledWith("30d");
  });

  it("shows loader when all-time data is loading", () => {
    render(
      <PeriodSelector
        value="all"
        onValueChange={vi.fn()}
        isAllLoading={true}
      />,
    );

    expect(screen.getByLabelText("Loading all-time data")).toBeInTheDocument();
  });
});
