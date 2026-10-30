import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitTypeToggle } from "@/components/habits/shared/HabitTypeToggle";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("HabitTypeToggle", () => {
  it("renders both options as tabs with the active one selected", () => {
    const onChange = vi.fn();
    render(<HabitTypeToggle value="boolean" onChange={onChange} />);

    const boolTab = screen.getByRole("tab", { name: "Yes or No" });
    const measurableTab = screen.getByRole("tab", { name: "Measurable" });

    expect(boolTab).toHaveAttribute("data-state", "active");
    expect(measurableTab).toHaveAttribute("data-state", "inactive");
  });

  it("calls onChange when clicking a different tab", () => {
    const onChange = vi.fn();
    render(<HabitTypeToggle value="boolean" onChange={onChange} />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Measurable" }));
    expect(onChange).toHaveBeenCalledWith("measurable");
  });

  it("does not call onChange when clicking the currently active tab", () => {
    const onChange = vi.fn();
    render(<HabitTypeToggle value="boolean" onChange={onChange} />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Yes or No" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
