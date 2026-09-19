import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitStripCell } from "@/components/habits/HabitStripCell";
import type { RollingDay } from "@/lib/utils/habit-rolling";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

function makeDay(overrides: Partial<RollingDay>): RollingDay {
  return {
    date: "2026-09-18",
    weekdayLabel: "F",
    value: 0,
    hasEntry: false,
    isToday: false,
    isBeforeStart: false,
    ...overrides,
  };
}

describe("HabitStripCell", () => {
  it("renders a missed X for an explicit zero entry", () => {
    render(
      <HabitStripCell
        day={makeDay({ value: 0, hasEntry: true })}
        color="#3b82f6"
        coarse={false}
        onToggle={vi.fn()}
      />,
    );
    expect(
      screen.getByLabelText(/Friday.*missed.*toggle/i),
    ).toBeInTheDocument();
  });

  it("calls onToggle for a boolean habit cell tap", () => {
    const onToggle = vi.fn();
    render(
      <HabitStripCell
        day={makeDay({ value: 0, hasEntry: false })}
        color="#3b82f6"
        coarse={false}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledWith("2026-09-18");
  });

  it("opens a logging popover for a measurable habit instead of toggling", () => {
    const onToggle = vi.fn();
    render(
      <HabitStripCell
        day={makeDay({ value: 6, hasEntry: true })}
        color="#3b82f6"
        coarse={false}
        onToggle={onToggle}
        habit={{
          habit_type: "measurable",
          target_type: "at_least",
          target_value: 10,
          unit: "pages",
        }}
        onLogValue={vi.fn()}
      />,
    );
    expect(screen.getByText("6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Log amount")).toBeInTheDocument();
  });

  it("logs the entered amount for a measurable habit", () => {
    const onLogValue = vi.fn();
    render(
      <HabitStripCell
        day={makeDay({ value: 0, hasEntry: false })}
        color="#3b82f6"
        coarse={false}
        onToggle={vi.fn()}
        habit={{
          habit_type: "measurable",
          target_type: "at_least",
          target_value: 10,
          unit: "pages",
        }}
        onLogValue={onLogValue}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByLabelText("Log amount"), {
      target: { value: "8" },
    });
    fireEvent.click(screen.getByText("Log"));
    expect(onLogValue).toHaveBeenCalledWith("2026-09-18", 8);
  });

  it("renders an explicit 0 log for a measurable habit as a logged amount, not a miss", () => {
    render(
      <HabitStripCell
        day={makeDay({ value: 0, hasEntry: true })}
        color="#3b82f6"
        coarse={false}
        onToggle={vi.fn()}
        habit={{
          habit_type: "measurable",
          target_type: "at_most",
          target_value: 0,
          unit: "cigarettes",
        }}
        onLogValue={vi.fn()}
      />,
    );
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByLabelText(/0 cigarettes logged/i)).toBeInTheDocument();
  });

  it("prefills the popover input with an existing 0 log instead of blank", () => {
    render(
      <HabitStripCell
        day={makeDay({ value: 0, hasEntry: true })}
        color="#3b82f6"
        coarse={false}
        onToggle={vi.fn()}
        habit={{
          habit_type: "measurable",
          target_type: null,
          target_value: null,
          unit: "cigarettes",
        }}
        onLogValue={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByLabelText("Log amount")).toHaveValue(0);
  });

  it("renders a measurable skip as a pause only, without a value badge", () => {
    render(
      <HabitStripCell
        day={makeDay({ value: -2, hasEntry: true })}
        color="#3b82f6"
        coarse={false}
        onToggle={vi.fn()}
        habit={{
          habit_type: "measurable",
          target_type: "at_least",
          target_value: 10,
          unit: "pages",
        }}
        onLogValue={vi.fn()}
      />,
    );
    expect(screen.queryByText("-2")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/skipped — log amount/i)).toBeInTheDocument();
  });
});
