import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitView } from "@/components/habits/HabitView";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/components/ui/responsive-dialog", () => ({
  ResponsiveDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResponsiveDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResponsiveDialogDescription: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div>{children}</div>,
}));

vi.mock("@/components/shared/ColorPicker", () => ({
  ColorPicker: () => <div data-testid="color-picker" />,
}));

vi.mock("@/components/habits/shared/HabitIconPicker", () => ({
  HabitIconPicker: () => <div data-testid="icon-picker" />,
  getHabitIcon: () => () => null,
}));

vi.mock("@/components/tasks/shared/TaskDatePicker", () => ({
  TaskDatePicker: () => <div data-testid="date-picker" />,
}));

describe("HabitView", () => {
  const baseProps = {
    name: "Test",
    setName: vi.fn(),
    description: "",
    setDescription: vi.fn(),
    color: "#ff0000",
    setColor: vi.fn(),
    icon: "Flame",
    setIcon: vi.fn(),
    startDate: undefined,
    setStartDate: vi.fn(),
    frequencyCount: 1,
    setFrequencyCount: vi.fn(),
    frequencyPeriod: "day" as const,
    setFrequencyPeriod: vi.fn(),
    targetValue: undefined,
    setTargetValue: vi.fn(),
    targetType: "at_least" as const,
    setTargetType: vi.fn(),
    unit: "",
    setUnit: vi.fn(),
    question: "",
    setQuestion: vi.fn(),
    reminderTime: null,
    setReminderTime: vi.fn(),
    reminderDays: 127,
    setReminderDays: vi.fn(),
    datePickerOpen: false,
    setDatePickerOpen: vi.fn(),
    isMobile: false,
    hasContent: true,
    isPending: false,
    onSubmit: vi.fn(),
    onKeyDown: vi.fn(),
    mode: "create" as const,
  };

  it("does not render the target field for a boolean habit", () => {
    render(
      <HabitView {...baseProps} habitType="boolean" setHabitType={vi.fn()} />,
    );
    expect(screen.queryByLabelText("Target value")).not.toBeInTheDocument();
  });

  it("renders the target field once switched to measurable", () => {
    const setHabitType = vi.fn();
    render(
      <HabitView
        {...baseProps}
        habitType="boolean"
        setHabitType={setHabitType}
      />,
    );
    fireEvent.click(screen.getByText("Measurable"));
    expect(setHabitType).toHaveBeenCalledWith("measurable");
  });

  it("shows the target field when habitType is already measurable", () => {
    render(
      <HabitView
        {...baseProps}
        habitType="measurable"
        setHabitType={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Target value")).toBeInTheDocument();
  });

  it("adapts the question placeholder to the habit type", () => {
    const { rerender } = render(
      <HabitView {...baseProps} habitType="boolean" setHabitType={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("More options"));
    expect(
      screen.getByPlaceholderText("Did you wake up early today?"),
    ).toBeInTheDocument();

    rerender(
      <HabitView
        {...baseProps}
        habitType="measurable"
        setHabitType={vi.fn()}
      />,
    );
    expect(
      screen.getByPlaceholderText("How many pages did you read?"),
    ).toBeInTheDocument();
  });

  it("keeps question, reminder and details behind More options", () => {
    render(
      <HabitView
        {...baseProps}
        mode="create"
        habitType="boolean"
        setHabitType={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Habit question")).toBeNull();
    expect(screen.queryByLabelText("Habit details")).toBeNull();

    fireEvent.click(screen.getByText("More options"));
    expect(screen.getByLabelText("Habit question")).toBeInTheDocument();
    expect(screen.getByLabelText("Habit details")).toBeInTheDocument();
    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("summarises what is set while More options is collapsed", () => {
    render(
      <HabitView
        {...baseProps}
        mode="create"
        habitType="boolean"
        setHabitType={vi.fn()}
        question="Did you run?"
        reminderTime="09:00"
        description=""
      />,
    );
    expect(screen.getByText("Question · Reminder")).toBeInTheDocument();
  });

  it("marks the active habit type segment", () => {
    render(
      <HabitView
        {...baseProps}
        habitType="measurable"
        setHabitType={vi.fn()}
      />,
    );
    expect(screen.getByText("Measurable")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Yes or No")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
