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

  it("should allow clearing via a native button with touch target expansion", async () => {
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
    expect(clearBtn.tagName).toBe("BUTTON");
    expect(clearBtn.className).toContain("before:absolute");
    expect(clearBtn.className).toContain("before:-inset-2");

    fireEvent.click(clearBtn);
    expect(setDate).toHaveBeenCalledWith(undefined);

    setDate.mockClear();
    fireEvent.click(clearBtn);
    expect(setDate).toHaveBeenCalledWith(undefined);

    setDate.mockClear();
    fireEvent.keyDown(clearBtn, { key: "Enter" });
    expect(setDate).toHaveBeenCalledWith(undefined);

    setDate.mockClear();
    fireEvent.keyDown(clearBtn, { key: " " });
    expect(setDate).toHaveBeenCalledWith(undefined);
  });

  it("should allow clearing chip variant via clear button", async () => {
    const setDate = vi.fn();
    const testDate = new Date("2026-11-04T12:00:00Z");
    const { fireEvent } = await import("@testing-library/react");

    render(
      <TaskDatePicker
        {...defaultProps}
        variant="chip"
        date={testDate}
        setDate={setDate}
        title="Due Date"
      />,
    );

    const clearBtn = screen.getByLabelText("Clear due date");
    expect(clearBtn).toBeInTheDocument();
    expect(clearBtn).toHaveClass("rounded-r-md", "rounded-l-none", "border-l");

    const triggerBtn = screen.getByTitle("Set due date");
    expect(triggerBtn).toHaveClass(
      "rounded-l-md",
      "rounded-r-none",
      "border-r-0",
    );

    fireEvent.click(clearBtn);
    expect(setDate).toHaveBeenCalledWith(undefined);
  });

  it("should pass contextual title to DateTimeWizard", () => {
    mockDateTimeWizard.mockClear();
    render(<TaskDatePicker {...defaultProps} title="Start Date" />);

    expect(mockDateTimeWizard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Set Start Date",
        allowClear: true,
      }),
    );
  });

  it("should render chip variant for Do Date and Due Date with accessible high-contrast styles", () => {
    // Unset Do Date chip should have neutral styling, not Kagelin blue
    const { unmount } = render(
      <TaskDatePicker
        {...defaultProps}
        variant="chip"
        title="Do Date"
        open={false}
      />,
    );
    const doChip = screen.getByRole("button", { name: /do date/i });
    expect(doChip).toHaveClass(
      "bg-secondary/40",
      "border-border/50",
      "text-foreground",
    );
    expect(doChip).not.toHaveClass("bg-brand/10", "text-brand");
    expect(screen.getByText("Do: None")).toBeInTheDocument();
    unmount();

    // Planned Today Do Date chip should have accessible high-contrast emphasis
    const today = new Date();
    const { unmount: unmountToday } = render(
      <TaskDatePicker
        {...defaultProps}
        variant="chip"
        title="Do Date"
        date={today}
        open={false}
      />,
    );
    const doChipToday = screen.getByRole("button", { name: /^do date:/i });
    expect(doChipToday).toHaveClass(
      "bg-secondary/70",
      "border-border/80",
      "font-semibold",
      "text-foreground",
    );
    expect(doChipToday).not.toHaveClass("bg-brand/10", "text-brand");
    const todayIcon = doChipToday.querySelector("svg");
    expect(todayIcon).toHaveClass("text-foreground");
    expect(screen.getByLabelText("Clear do date")).toBeInTheDocument();
    unmountToday();

    // Do Date on a future date (not today) should have neutral chip styling
    const futureDoDate = new Date();
    futureDoDate.setDate(futureDoDate.getDate() + 2);
    const { unmount: unmountFutureDo } = render(
      <TaskDatePicker
        {...defaultProps}
        variant="chip"
        title="Do Date"
        date={futureDoDate}
        open={false}
      />,
    );
    const doChipFuture = screen.getByRole("button", { name: /^do date:/i });
    expect(doChipFuture).toHaveClass(
      "bg-secondary/40",
      "border-border/50",
      "text-foreground",
    );
    expect(doChipFuture).not.toHaveClass("bg-secondary/70", "font-semibold");
    const futureDoIcon = doChipFuture.querySelector("svg");
    expect(futureDoIcon).toHaveClass("text-muted-foreground");
    expect(screen.getByLabelText("Clear do date")).toBeInTheDocument();
    unmountFutureDo();

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
    const { unmount: unmountPastDue } = render(
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
    unmountPastDue();

    // Past Do Date should NOT have overdue highlight, but operational replanning dashed border
    const pastDoDate = new Date("2020-01-01T00:00:00Z");
    render(
      <TaskDatePicker
        {...defaultProps}
        variant="chip"
        title="Do Date"
        date={pastDoDate}
        open={false}
      />,
    );
    const pastDoChip = screen.getByTitle("Set do date");
    expect(pastDoChip).not.toHaveClass("bg-secondary/70", "font-semibold");
    expect(pastDoChip).toHaveClass("border-dashed");
  });

  it("distinguishes operational schedule from external deadline in wizard descriptions", () => {
    mockDateTimeWizard.mockClear();
    const { unmount } = render(
      <TaskDatePicker {...defaultProps} title="Do Date" open={true} />,
    );
    expect(mockDateTimeWizard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Set Do Date",
        description: "Operational schedule (when to work on it)",
      }),
    );
    unmount();

    mockDateTimeWizard.mockClear();
    render(<TaskDatePicker {...defaultProps} title="Due Date" open={true} />);
    expect(mockDateTimeWizard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Set Due Date",
        description: "Deadline (external commitment)",
      }),
    );
  });

  it("does not render dashed reschedule styling on completed tasks with past do_date", () => {
    const pastDoDate = new Date();
    pastDoDate.setDate(pastDoDate.getDate() - 3);

    render(
      <TaskDatePicker
        {...defaultProps}
        variant="chip"
        title="Do Date"
        date={pastDoDate}
        open={false}
        isCompleted={true}
      />,
    );
    const pastDoChip = screen.getByTitle("Set do date");
    expect(pastDoChip).not.toHaveClass("border-dashed");
  });
});
