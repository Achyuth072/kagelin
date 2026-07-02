import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitView } from "@/components/habits/HabitView";

// Mock haptics
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
  }),
}));

// Mock the components used in the views
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
    frequencyCount: 1,
    setFrequencyCount: vi.fn(),
    frequencyPeriod: "day" as const,
    setFrequencyPeriod: vi.fn(),
    datePickerOpen: false,
    setDatePickerOpen: vi.fn(),
    isMobile: false,
    hasContent: true,
    isPending: false,
    onSubmit: vi.fn(),
    onKeyDown: vi.fn(),
  };

  it("HabitView edit footer should not contain color picker", () => {
    render(<HabitView {...commonProps} mode="edit" onDelete={vi.fn()} />);

    const footer = screen.getByLabelText(/save/i).closest("div")!;
    const colorPicker = screen.getByTestId("color-picker");
    expect(footer.contains(colorPicker)).toBe(false);
  });

  it("HabitView create footer should not contain color picker", () => {
    render(<HabitView {...commonProps} mode="create" />);

    const footer = screen.getByLabelText(/start habit/i).closest("div")!;
    const colorPicker = screen.getByTestId("color-picker");
    expect(footer.contains(colorPicker)).toBe(false);
  });

  it("Color picker should be in the view (structural verification)", () => {
    render(<HabitView {...commonProps} mode="create" />);

    const colorPicker = screen.getByTestId("color-picker");
    expect(colorPicker).toBeDefined();

    // Check it's not in the footer grid
    const footer = screen.getByLabelText(/start habit/i).closest("div")!;
    expect(footer.contains(colorPicker)).toBe(false);
  });
});
