import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitTargetField } from "@/components/habits/shared/HabitTargetField";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("HabitTargetField", () => {
  const baseProps = {
    targetValue: 10,
    unit: "pages",
    targetType: "at_least" as const,
    onTargetValueChange: vi.fn(),
    onUnitChange: vi.fn(),
    onTargetTypeChange: vi.fn(),
  };

  it("renders the target value and unit inputs", () => {
    render(<HabitTargetField {...baseProps} />);
    expect(screen.getByLabelText("Target value")).toHaveValue(10);
    expect(screen.getByLabelText("Target unit")).toHaveValue("pages");
  });

  it("calls onTargetValueChange when the target value input changes", () => {
    const onTargetValueChange = vi.fn();
    render(
      <HabitTargetField
        {...baseProps}
        onTargetValueChange={onTargetValueChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Target value"), {
      target: { value: "20" },
    });
    expect(onTargetValueChange).toHaveBeenCalledWith(20);
  });

  it("calls onUnitChange when the unit input changes", () => {
    const onUnitChange = vi.fn();
    render(<HabitTargetField {...baseProps} onUnitChange={onUnitChange} />);
    fireEvent.change(screen.getByLabelText("Target unit"), {
      target: { value: "km" },
    });
    expect(onUnitChange).toHaveBeenCalledWith("km");
  });

  it("marks the active direction segment and calls onTargetTypeChange on switch", () => {
    const onTargetTypeChange = vi.fn();
    render(
      <HabitTargetField
        {...baseProps}
        onTargetTypeChange={onTargetTypeChange}
      />,
    );
    expect(screen.getByLabelText("At least")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByLabelText("At most"));
    expect(onTargetTypeChange).toHaveBeenCalledWith("at_most");
  });
});
