import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskDatePicker } from "@/components/tasks/shared/TaskDatePicker";
import React from "react";

// Mock the Popover components from Radix UI
vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
  }) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({
    children,
    align,
    sideOffset,
    collisionPadding,
  }: {
    children: React.ReactNode;
    align: string;
    sideOffset: number;
    collisionPadding: number;
  }) => (
    <div
      data-testid="popover-content"
      data-align={align}
      data-side-offset={sideOffset}
      data-collision-padding={collisionPadding}
    >
      {children}
    </div>
  ),
}));

// Mock DateTimeWizard
const mockDateTimeWizard = vi.fn();
vi.mock("@/components/ui/date-time-wizard", () => ({
  DateTimeWizard: (props: unknown) => {
    mockDateTimeWizard(props);
    return <div data-testid="datetime-wizard">Wizard</div>;
  },
}));

// Mock Haptic hook
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("TaskDatePicker", () => {
  const defaultProps = {
    date: undefined,
    setDate: vi.fn(),
    isMobile: false,
    open: true,
    onOpenChange: vi.fn(),
  };

  it("should use center alignment by default to prevent viewport clipping", () => {
    // Given: TaskDatePicker is rendered on desktop
    // When: The component is rendered
    render(<TaskDatePicker {...defaultProps} />);

    // Then: PopoverContent should have align="center"
    const popoverContent = screen.getByTestId("popover-content");
    expect(popoverContent.getAttribute("data-align")).toBe("center");
  });

  it("should render visible label and title when date is unset, including on mobile", () => {
    render(
      <TaskDatePicker
        {...defaultProps}
        open={false}
        title="Start Date"
        isMobile={true}
      />,
    );

    expect(screen.getByText("Start Date")).toBeDefined();
    const button = screen.getByRole("button", { name: /start date/i });
    expect(button.getAttribute("title")).toBe("Set start date");
  });

  it("should display prefix when date is set", () => {
    const testDate = new Date("2026-11-04T12:00:00Z");
    render(
      <TaskDatePicker {...defaultProps} date={testDate} title="Due Date" />,
    );

    expect(screen.getByText(/Due:/)).toBeDefined();
  });

  it("should allow clearing via keyboard (Enter and Space) with touch target expansion", async () => {
    const setDate = vi.fn();
    const testDate = new Date("2026-11-04T12:00:00Z");
    const { fireEvent } = await import("@testing-library/react");

    render(
      <TaskDatePicker
        {...defaultProps}
        date={testDate}
        setDate={setDate}
        title="Due Date"
      />,
    );

    const clearBtn = screen.getByLabelText("Clear due date");
    expect(clearBtn.getAttribute("tabindex")).toBe("0");
    expect(clearBtn.className).toContain("before:absolute");
    expect(clearBtn.className).toContain("before:-inset-2");

    fireEvent.keyDown(clearBtn, { key: "Enter" });
    expect(setDate).toHaveBeenCalledWith(undefined);

    setDate.mockClear();
    fireEvent.keyDown(clearBtn, { key: " " });
    expect(setDate).toHaveBeenCalledWith(undefined);
  });

  it("should pass contextual title to DateTimeWizard", () => {
    mockDateTimeWizard.mockClear();
    render(<TaskDatePicker {...defaultProps} title="Start Date" />);

    expect(mockDateTimeWizard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Set Start Date",
      }),
    );
  });

  it("should render chip variant for Do Date and Due Date with expected styles", () => {
    const { unmount } = render(
      <TaskDatePicker
        {...defaultProps}
        variant="chip"
        title="Do Date"
        open={false}
      />,
    );
    const doChip = screen.getByRole("button", { name: /do date/i });
    expect(doChip).toHaveClass("bg-brand/10", "text-brand");
    expect(screen.getByText("Do: Today")).toBeInTheDocument();
    unmount();

    // Normal due date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const { unmount: unmountDue } = render(
      <TaskDatePicker
        {...defaultProps}
        variant="chip"
        title="Due Date"
        date={futureDate}
        open={false}
      />,
    );
    const dueChip = screen.getByTitle("Set due date");
    expect(dueChip).toHaveClass("bg-secondary/40", "border-border/50");
    unmountDue();

    // Overdue due date
    const pastDate = new Date("2020-01-01T00:00:00Z");
    render(
      <TaskDatePicker
        {...defaultProps}
        variant="chip"
        title="Due Date"
        date={pastDate}
        open={false}
      />,
    );
    const overdueChip = screen.getByTitle("Set due date");
    expect(overdueChip).toHaveClass("bg-secondary/70", "font-semibold");
  });
});
