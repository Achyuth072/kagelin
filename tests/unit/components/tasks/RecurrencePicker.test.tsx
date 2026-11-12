import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RecurrencePicker from "@/components/tasks/TaskSheet/RecurrencePicker";
import "@testing-library/jest-dom";
import React from "react";

// Mock hooks
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

// Mock Popover to simplify testing
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover">{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

describe("RecurrencePicker Repetition State", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getTriggerButton = () => {
    const trigger = screen.getByTestId("popover-trigger");
    return within(trigger).getByRole("button");
  };

  it("should show inactive state when value is null", () => {
    // Given: value is null
    render(
      <RecurrencePicker value={null} onChange={mockOnChange} variant="icon" />,
    );

    // Then: Button should have inactive tooltip and classes
    const button = getTriggerButton();
    expect(button).toHaveAttribute("title", "Does not repeat");
    // Class check - inactive state should have text-muted-foreground
    expect(button.className).toContain("text-muted-foreground");
    expect(button.className).not.toContain("text-brand");
  });

  it("should show inactive state when value is undefined", () => {
    // Given: value is undefined
    render(
      <RecurrencePicker
        value={undefined as never}
        onChange={mockOnChange}
        variant="icon"
      />,
    );

    // Then: Button should be inactive (Fix verification)
    const button = getTriggerButton();
    expect(button).toHaveAttribute("title", "Does not repeat");
    expect(button.className).toContain("text-muted-foreground");
    expect(button.className).not.toContain("text-brand");
  });

  it("should show active state when a recurrence rule is provided", () => {
    // Given: a Daily recurrence rule
    const rule = { freq: "DAILY" as const, interval: 1 };

    render(
      <RecurrencePicker value={rule} onChange={mockOnChange} variant="icon" />,
    );

    // Then: Button should show brand colors and 'D' badge
    const button = getTriggerButton();
    expect(button).toHaveAttribute("title", "Daily");
    expect(button.className).toContain("text-brand");
    expect(within(button).getByText("D")).toBeInTheDocument();
  });

  it("should render Strict and Flexible tabs and switch mode on tab selection", () => {
    const rule = {
      freq: "WEEKLY" as const,
      interval: 1,
      mode: "flexible" as const,
    };

    render(
      <RecurrencePicker value={rule} onChange={mockOnChange} variant="icon" />,
    );

    const content = screen.getByTestId("popover-content");
    const flexibleTab = within(content).getByRole("tab", { name: "Flexible" });
    const strictTab = within(content).getByRole("tab", { name: "Strict" });

    expect(flexibleTab).toHaveAttribute("data-state", "active");
    expect(strictTab).toHaveAttribute("data-state", "inactive");

    fireEvent.mouseDown(flexibleTab);
    expect(mockOnChange).not.toHaveBeenCalled();

    fireEvent.mouseDown(strictTab);
    expect(mockOnChange).toHaveBeenCalledWith({
      freq: "WEEKLY",
      interval: 1,
      mode: "strict",
    });
  });

  it("should style chip variant as active when recurrence is set and inactive when null", () => {
    const { unmount } = render(
      <RecurrencePicker value={null} onChange={mockOnChange} variant="chip" />,
    );

    let chip = screen.getByRole("button", {
      name: /(?:Repeat|Recurrence): None/i,
    });
    expect(chip.className).toContain("text-muted-foreground");
    expect(chip.className).not.toContain("text-foreground font-semibold");

    unmount();

    render(
      <RecurrencePicker
        value={{ freq: "DAILY", interval: 1 }}
        onChange={mockOnChange}
        variant="chip"
      />,
    );

    chip = screen.getByRole("button", {
      name: /(?:Repeat|Recurrence): Daily/i,
    });
    expect(chip.className).toContain("text-foreground");
    expect(chip.className).toContain("font-semibold");
    expect(chip.className).toContain("bg-secondary/70");
  });

  it("should toggle inline expansion on chip click and allow selecting presets and modes", () => {
    const { rerender } = render(
      <RecurrencePicker value={null} onChange={mockOnChange} variant="chip" />,
    );

    const chip = screen.getByRole("button", {
      name: /(?:Repeat|Recurrence): None/i,
    });
    fireEvent.click(chip);

    // Preset buttons are rendered in the inline reveal
    const weeklyBtn = screen.getByRole("button", { name: "Weekly" });
    expect(weeklyBtn).toBeInTheDocument();

    fireEvent.click(weeklyBtn);
    expect(mockOnChange).toHaveBeenCalledWith({
      freq: "WEEKLY",
      interval: 1,
      mode: "flexible",
    });

    // Rerender with the active value
    rerender(
      <RecurrencePicker
        value={{ freq: "WEEKLY", interval: 1, mode: "flexible" }}
        onChange={mockOnChange}
        variant="chip"
      />,
    );

    const strictTab = screen.getByRole("tab", { name: "Strict" });
    fireEvent.mouseDown(strictTab);
    expect(mockOnChange).toHaveBeenCalledWith({
      freq: "WEEKLY",
      interval: 1,
      mode: "strict",
    });
  });
});
