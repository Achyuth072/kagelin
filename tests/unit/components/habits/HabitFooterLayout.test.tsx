import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitView } from "@/components/habits/HabitView";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
  }),
}));

vi.mock("@/components/ui/responsive-dialog", () => ({
  ResponsiveDialogHeader: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  ResponsiveDialogTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  ResponsiveDialogDescription: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
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

describe("Habit Views Footer Layout", () => {
  const commonProps = {
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
    habitType: "boolean" as const,
    setHabitType: vi.fn(),
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
  };

  it("HabitView edit footer should not contain color picker", () => {
    render(
      <HabitView
        {...commonProps}
        mode="edit"
        onArchive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const footer = screen.getByLabelText(/save/i).closest("div")!;
    fireEvent.click(screen.getByText("Icon & color"));
    const colorPicker = screen.getByTestId("color-picker");
    expect(footer.contains(colorPicker)).toBe(false);
  });

  it("HabitView create footer should not contain color picker", () => {
    render(<HabitView {...commonProps} mode="create" />);

    const footer = screen.getByLabelText(/start habit/i).closest("div")!;
    fireEvent.click(screen.getByText("Icon & color"));
    const colorPicker = screen.getByTestId("color-picker");
    expect(footer.contains(colorPicker)).toBe(false);
  });

  it("Icon & color pickers stay collapsed until the row is opened", () => {
    render(<HabitView {...commonProps} mode="create" />);

    expect(screen.queryByTestId("color-picker")).toBeNull();
    fireEvent.click(screen.getByText("Icon & color"));
    expect(screen.getByTestId("color-picker")).toBeDefined();
    expect(screen.getByTestId("icon-picker")).toBeDefined();
  });

  it("Color picker should be in the view (structural verification)", () => {
    render(<HabitView {...commonProps} mode="create" />);

    fireEvent.click(screen.getByText("Icon & color"));
    const colorPicker = screen.getByTestId("color-picker");
    expect(colorPicker).toBeDefined();

    const footer = screen.getByLabelText(/start habit/i).closest("div")!;
    expect(footer.contains(colorPicker)).toBe(false);
  });
});
