import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DateTimeWizard } from "@/components/ui/date-time-wizard";
import React from "react";

// Mock Haptic hook
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

// Mock scroll isolation
vi.mock("@/lib/hooks/useScrollIsolation", () => ({
  useScrollIsolation: vi.fn(),
}));

describe("DateTimeWizard", () => {
  it("renders contextual title when provided", () => {
    render(
      <DateTimeWizard
        title="Set Start Date"
        date={undefined}
        setDate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Set Start Date")).toBeDefined();
  });

  it("renders Clear button and clears date when clicked", async () => {
    const setDate = vi.fn();
    const onClose = vi.fn();
    const testDate = new Date("2026-11-20T12:00:00Z");
    const { fireEvent } = await import("@testing-library/react");

    render(
      <DateTimeWizard
        title="Set Due Date"
        date={testDate}
        setDate={setDate}
        onClose={onClose}
        allowClear={true}
      />,
    );

    const clearButton = screen.getByRole("button", { name: /clear/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(setDate).toHaveBeenCalledWith(undefined);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render Clear button when allowClear is false or date is unset", () => {
    const { unmount } = render(
      <DateTimeWizard
        title="Set Start Date"
        date={new Date()}
        setDate={vi.fn()}
        onClose={vi.fn()}
        allowClear={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
    unmount();

    render(
      <DateTimeWizard
        title="Set Start Date"
        date={undefined}
        setDate={vi.fn()}
        onClose={vi.fn()}
        allowClear={true}
      />,
    );

    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
  });

  it("allows clicking Time tab when date is undefined and auto-selects Today", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(
      <DateTimeWizard
        title="Set Due Date"
        date={undefined}
        setDate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const timeTab = screen.getByRole("tab", { name: /time/i });
    expect(timeTab).not.toBeDisabled();

    // Radix Tabs activates on mouseDown / click / pointerDown
    fireEvent.mouseDown(timeTab);
    fireEvent.click(timeTab);

    expect(
      screen.getByRole("spinbutton", { name: "Adjust Hours" }),
    ).toBeInTheDocument();
  });
});
