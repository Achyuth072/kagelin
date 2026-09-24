import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitStripCell } from "@/components/habits/HabitStripCell";
import type { RollingDay } from "@/lib/utils/habit-rolling";
import { ENTRY_VALUE_SKIPPED } from "@/lib/types/habit";

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
    isFuture: false,
    ...overrides,
  };
}

describe("HabitStripCell", () => {
  it.each([
    [{ value: 0, hasEntry: false }, "not logged"],
    [{ value: 1, hasEntry: true }, "done"],
    [{ value: 0, hasEntry: true }, "not done"],
    [{ value: ENTRY_VALUE_SKIPPED, hasEntry: true }, "skipped"],
  ])("names a %o day's date and state in words", (day, state) => {
    render(
      <HabitStripCell
        day={makeDay(day)}
        color="#3b82f6"
        coarse={false}
        onToggle={vi.fn()}
      />,
    );
    const cell = screen.getByRole("button", {
      name: `Friday Sep 18, ${state}`,
    });
    expect(cell).toHaveAttribute("title", state);
    expect(cell).not.toHaveAttribute("aria-pressed");
  });

  it("announces the resulting state after activation, not before", () => {
    const props = {
      color: "#3b82f6",
      coarse: false,
      onToggle: vi.fn(),
    };
    const { rerender } = render(
      <HabitStripCell day={makeDay({ value: 1, hasEntry: true })} {...props} />,
    );
    const region = document.querySelector('[aria-live="polite"]');
    expect(region).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button"));
    expect(region).toHaveTextContent("");

    rerender(
      <HabitStripCell
        day={makeDay({ value: ENTRY_VALUE_SKIPPED, hasEntry: true })}
        {...props}
      />,
    );
    expect(region).toHaveTextContent("skipped");
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

  describe("measurable logging popover", () => {
    it("writes the skipped value from the Skip control", () => {
      const onLogValue = vi.fn();
      render(
        <HabitStripCell
          day={makeDay({ value: 6, hasEntry: true })}
          color="#3b82f6"
          coarse={false}
          onToggle={vi.fn()}
          habit={measurable}
          onLogValue={onLogValue}
        />,
      );
      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "Skip" }));
      expect(onLogValue).toHaveBeenCalledWith(
        "2026-09-18",
        ENTRY_VALUE_SKIPPED,
      );
    });

    it("logs exactly the target in one tap from the chip", () => {
      const onLogValue = vi.fn();
      render(
        <HabitStripCell
          day={makeDay({ value: 0, hasEntry: false })}
          color="#3b82f6"
          coarse={false}
          onToggle={vi.fn()}
          habit={measurable}
          onLogValue={onLogValue}
        />,
      );
      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button", { name: "10 pages" }));
      expect(onLogValue).toHaveBeenCalledWith("2026-09-18", 10);
    });

    it("shows no target chip when the habit has no target", () => {
      render(
        <HabitStripCell
          day={makeDay({ value: 0, hasEntry: false })}
          color="#3b82f6"
          coarse={false}
          onToggle={vi.fn()}
          habit={{ ...measurable, target_type: null, target_value: null }}
          onLogValue={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole("button"));
      expect(
        screen.queryByRole("button", { name: /pages/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    });

    const measurable = {
      habit_type: "measurable" as const,
      target_type: "at_least" as const,
      target_value: 10,
      unit: "pages",
    };

    it("does not log 0 when the amount is left empty", () => {
      const onLogValue = vi.fn();
      const onClearValue = vi.fn();
      render(
        <HabitStripCell
          day={makeDay({ value: 0, hasEntry: false })}
          color="#3b82f6"
          coarse={false}
          onToggle={vi.fn()}
          habit={measurable}
          onLogValue={onLogValue}
          onClearValue={onClearValue}
        />,
      );
      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Log"));
      expect(onLogValue).not.toHaveBeenCalled();
      expect(onClearValue).not.toHaveBeenCalled();
    });

    it("clears an existing value when the amount is emptied and submitted", () => {
      const onLogValue = vi.fn();
      const onClearValue = vi.fn();
      render(
        <HabitStripCell
          day={makeDay({ value: 6, hasEntry: true })}
          color="#3b82f6"
          coarse={false}
          onToggle={vi.fn()}
          habit={measurable}
          onLogValue={onLogValue}
          onClearValue={onClearValue}
        />,
      );
      fireEvent.click(screen.getByRole("button"));
      fireEvent.change(screen.getByLabelText("Log amount"), {
        target: { value: "" },
      });
      fireEvent.click(screen.getByText("Log"));
      expect(onClearValue).toHaveBeenCalledWith("2026-09-18");
      expect(onLogValue).not.toHaveBeenCalled();
    });
  });

  it("applies compact sm styling when size prop is sm", () => {
    const { container } = render(
      <HabitStripCell
        day={makeDay({ value: 1, hasEntry: true })}
        color="#3b82f6"
        coarse={false}
        onToggle={vi.fn()}
        size="sm"
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("w-full");
    const button = screen.getByRole("button");
    expect(button).toHaveClass("h-8", "w-8", "aspect-square");
  });
});
