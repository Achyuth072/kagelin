import type React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HabitSheet } from "@/components/habits/HabitSheet";
import {
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
} from "@/lib/hooks/useHabitMutations";
import type { Habit } from "@/lib/types/habit";

vi.mock("@/lib/hooks/useHabitMutations", () => ({
  useCreateHabit: vi.fn(),
  useUpdateHabit: vi.fn(),
  useDeleteHabit: vi.fn(),
}));

vi.mock("@/components/ui/responsive-dialog", () => ({
  ResponsiveDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
  }) => (open ? <div>{children}</div> : null),
  ResponsiveDialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  ResponsiveDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResponsiveDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  ResponsiveDialogDescription: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <p>{children}</p>,
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn(), isPhone: false }),
}));

vi.mock("../tasks/shared/TaskDatePicker", () => ({
  TaskDatePicker: () => <div data-testid="date-picker">Date Picker</div>,
}));

const mockHabit = {
  id: "1",
  name: "Exercise",
  description: "Daily workout",
  color: "#4B6CB7",
  icon: "Flame",
} as unknown as Habit;

describe("HabitSheet — Insights tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useCreateHabit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useUpdateHabit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useDeleteHabit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it("toggles to Insights: swaps body and widens the dialog", async () => {
    // Given: edit mode, currently on the Edit tab
    await act(async () => {
      render(
        <HabitSheet open={true} onClose={() => {}} initialHabit={mockHabit} />,
      );
    });
    expect(screen.getByTestId("dialog-content").className).toContain(
      "sm:max-w-lg",
    );

    // When: the Insights tab is clicked
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "Insights" }));
    });

    // Then: the edit form is gone, Insights content is shown, dialog widened
    expect(screen.queryByPlaceholderText("Habit name")).not.toBeInTheDocument();
    expect(screen.getByTestId("dialog-content").className).toContain(
      "sm:max-w-2xl",
    );

    // When: toggled back to Edit
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "Edit" }));
    });

    // Then: edit form returns, dialog narrows back
    expect(screen.getByPlaceholderText("Habit name")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content").className).toContain(
      "sm:max-w-lg",
    );
  });

  it("hides the toggle in create mode, even with initialTab='insights'", async () => {
    // Given/When: create mode (no initialHabit) with a stale initialTab
    await act(async () => {
      render(
        <HabitSheet open={true} onClose={() => {}} initialTab="insights" />,
      );
    });

    // Then: no Insights/Edit toggle renders, and the create form is shown
    expect(
      screen.queryByRole("radio", { name: "Insights" }),
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Habit name")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content").className).toContain(
      "sm:max-w-lg",
    );
  });

  it("opens directly on Insights when initialTab='insights' in edit mode", async () => {
    // Given/When: edit mode opened with initialTab="insights"
    await act(async () => {
      render(
        <HabitSheet
          open={true}
          onClose={() => {}}
          initialHabit={mockHabit}
          initialTab="insights"
        />,
      );
    });

    // Then: Insights is already active, edit form is not shown
    expect(screen.getByRole("radio", { name: "Insights" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.queryByPlaceholderText("Habit name")).not.toBeInTheDocument();
  });
});
