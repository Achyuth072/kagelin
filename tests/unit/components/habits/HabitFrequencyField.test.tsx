import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitFrequencyField } from "@/components/habits/shared/HabitFrequencyField";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

function renderField(
  props: Partial<Parameters<typeof HabitFrequencyField>[0]> = {},
) {
  const defaults = {
    count: 1,
    period: "day" as const,
    frequencyDays: undefined as number | undefined,
    onCountChange: vi.fn(),
    onPeriodChange: vi.fn(),
    onFrequencyDaysChange: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  return {
    ...render(<HabitFrequencyField {...merged} />),
    onCountChange: merged.onCountChange,
    onPeriodChange: merged.onPeriodChange,
    onFrequencyDaysChange: merged.onFrequencyDaysChange,
  };
}

const pressed = (name: RegExp) =>
  screen.getByRole("button", { name }).getAttribute("aria-pressed");

describe("HabitFrequencyField — four segments", () => {
  it("renders Daily, Weekly, Monthly, Custom", () => {
    renderField();
    for (const n of [/daily/i, /weekly/i, /monthly/i, /custom/i]) {
      expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
    }
  });

  it.each([
    ["1-in-1 → Daily", { count: 1, period: "day" as const }, /daily/i],
    ["3-in-7 → Weekly", { count: 3, frequencyDays: 7 }, /weekly/i],
    [
      "3 per week period → Weekly",
      { count: 3, period: "week" as const },
      /weekly/i,
    ],
    ["10-in-30 → Monthly", { count: 10, frequencyDays: 30 }, /monthly/i],
    ["1-in-3 → Custom", { count: 1, frequencyDays: 3 }, /custom/i],
    ["2-in-14 → Custom", { count: 2, frequencyDays: 14 }, /custom/i],
  ])("%s", (_l, props, name) => {
    renderField({ period: undefined, ...props });
    expect(pressed(name)).toBe("true");
  });
});

describe("HabitFrequencyField — segment switching calls correct callbacks", () => {
  it("Daily resets count, period and days", () => {
    const { onCountChange, onPeriodChange, onFrequencyDaysChange } =
      renderField({ count: 3, period: "week" });
    fireEvent.click(screen.getByRole("button", { name: /daily/i }));
    expect(onCountChange).toHaveBeenCalledWith(1);
    expect(onPeriodChange).toHaveBeenCalledWith("day");
    expect(onFrequencyDaysChange).toHaveBeenCalledWith(undefined);
  });

  it("Weekly sets the week period and clears days", () => {
    const { onPeriodChange, onFrequencyDaysChange } = renderField();
    fireEvent.click(screen.getByRole("button", { name: /weekly/i }));
    expect(onPeriodChange).toHaveBeenCalledWith("week");
    expect(onFrequencyDaysChange).toHaveBeenCalledWith(undefined);
  });

  it("Monthly sets the month period and clears days", () => {
    const { onPeriodChange, onFrequencyDaysChange } = renderField();
    fireEvent.click(screen.getByRole("button", { name: /monthly/i }));
    expect(onPeriodChange).toHaveBeenCalledWith("month");
    expect(onFrequencyDaysChange).toHaveBeenCalledWith(undefined);
  });

  it("Custom clears the period and sets days ≥ 2", () => {
    const { onPeriodChange, onFrequencyDaysChange } = renderField();
    fireEvent.click(screen.getByRole("button", { name: /custom/i }));
    expect(onPeriodChange).toHaveBeenCalledWith(null);
    const daysArg = (onFrequencyDaysChange as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as number;
    expect(daysArg).toBeGreaterThanOrEqual(2);
  });

  it("stays on Custom when the typed D equals 7", () => {
    const { rerender } = render(
      <HabitFrequencyField
        count={1}
        period="day"
        frequencyDays={undefined}
        onCountChange={vi.fn()}
        onPeriodChange={vi.fn()}
        onFrequencyDaysChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /custom/i }));
    rerender(
      <HabitFrequencyField
        count={1}
        period={undefined}
        frequencyDays={7}
        onCountChange={vi.fn()}
        onPeriodChange={vi.fn()}
        onFrequencyDaysChange={vi.fn()}
      />,
    );
    expect(pressed(/custom/i)).toBe("true");
    expect(screen.getByLabelText(/number of days/i)).toBeInTheDocument();
  });
});

describe("HabitFrequencyField — D input bounds", () => {
  it("D input is present in Custom", () => {
    renderField({ count: 1, period: undefined, frequencyDays: 5 });
    expect(screen.getByLabelText(/number of days/i)).toBeInTheDocument();
  });

  it("D input shows the current frequencyDays value", () => {
    renderField({ count: 1, frequencyDays: 42 });
    const input = screen.getByLabelText(/number of days/i);
    expect((input as HTMLInputElement).value).toBe("42");
  });

  it("count stepper is absent in Daily mode", () => {
    renderField({ count: 1, period: "day" });
    expect(
      screen.queryByRole("button", { name: /fewer times/i }),
    ).not.toBeInTheDocument();
  });

  it("count stepper is present in Weekly", () => {
    renderField({ count: 3, period: "week" });
    expect(
      screen.getByRole("button", { name: /fewer times/i }),
    ).toBeInTheDocument();
  });
});
