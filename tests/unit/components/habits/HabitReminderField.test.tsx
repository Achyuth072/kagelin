import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitReminderField } from "@/components/habits/shared/HabitReminderField";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("HabitReminderField", () => {
  it("renders Off and hides the time/day chips when there is no reminder time", () => {
    render(
      <HabitReminderField
        reminderTime={null}
        onReminderTimeChange={vi.fn()}
        reminderDays={127}
        onReminderDaysChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.queryByLabelText("Reminder time")).not.toBeInTheDocument();
  });

  it("turns on with a default time when the toggle is clicked", () => {
    const onReminderTimeChange = vi.fn();
    render(
      <HabitReminderField
        reminderTime={null}
        onReminderTimeChange={onReminderTimeChange}
        reminderDays={127}
        onReminderDaysChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Off"));
    expect(onReminderTimeChange).toHaveBeenCalledWith("09:00");
  });

  it("shows the time input and day chips once a reminder time is set", () => {
    render(
      <HabitReminderField
        reminderTime="08:30"
        onReminderTimeChange={vi.fn()}
        reminderDays={127}
        onReminderDaysChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Reminder time")).toHaveValue("08:30");
    expect(screen.getByLabelText("Sunday")).toBeInTheDocument();
    expect(screen.getByLabelText("Saturday")).toBeInTheDocument();
  });

  it("toggles a day's bit off when its chip is clicked", () => {
    const onReminderDaysChange = vi.fn();
    render(
      <HabitReminderField
        reminderTime="08:30"
        onReminderTimeChange={vi.fn()}
        reminderDays={127}
        onReminderDaysChange={onReminderDaysChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Sunday"));
    expect(onReminderDaysChange).toHaveBeenCalledWith(126);
  });

  it("toggles a day's bit on when its chip is clicked from an unset mask", () => {
    const onReminderDaysChange = vi.fn();
    render(
      <HabitReminderField
        reminderTime="08:30"
        onReminderTimeChange={vi.fn()}
        reminderDays={0}
        onReminderDaysChange={onReminderDaysChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Monday"));
    expect(onReminderDaysChange).toHaveBeenCalledWith(2);
  });
});
