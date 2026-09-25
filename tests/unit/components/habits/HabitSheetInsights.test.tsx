import type React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HabitSheet } from "@/components/habits/HabitSheet";
import {
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useArchiveHabit,
} from "@/lib/hooks/useHabitMutations";
import type { Habit } from "@/lib/types/habit";

vi.mock("@/lib/hooks/useHabitMutations", () => ({
  useCreateHabit: vi.fn(),
  useUpdateHabit: vi.fn(),
  useDeleteHabit: vi.fn(),
  useArchiveHabit: vi.fn(),
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

vi.mock("@/lib/hooks/useHabits", () => ({
  useHabit: () => ({
    data: { id: "1", entries: [] },
    isLoading: false,
  }),
}));

vi.mock("../tasks/shared/TaskDatePicker", () => ({
  TaskDatePicker: () => <div data-testid="date-picker">Date Picker</div>,
}));

vi.mock("recharts", () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
    (useArchiveHabit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useDeleteHabit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it("toggles to Insights: swaps body, dialog width stays unified", async () => {
    await act(async () => {
      render(
        <HabitSheet open={true} onClose={() => {}} initialHabit={mockHabit} />,
      );
    });
    expect(screen.getByTestId("dialog-content").className).toContain(
      "sm:max-w-lg",
    );

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Insights" }));
    });

    expect(screen.queryByPlaceholderText("Habit name")).not.toBeInTheDocument();
    expect(screen.getByTestId("dialog-content").className).toContain(
      "sm:max-w-lg",
    );

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Edit" }));
    });

    expect(screen.getByPlaceholderText("Habit name")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content").className).toContain(
      "sm:max-w-lg",
    );
  });

  it("hides the toggle in create mode, even with initialTab='insights'", async () => {
    await act(async () => {
      render(
        <HabitSheet open={true} onClose={() => {}} initialTab="insights" />,
      );
    });

    expect(
      screen.queryByRole("tab", { name: "Insights" }),
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Habit name")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content").className).toContain(
      "sm:max-w-lg",
    );
  });

  it("opens directly on Insights when initialTab='insights' in edit mode", async () => {
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

    expect(screen.getByRole("tab", { name: "Insights" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByPlaceholderText("Habit name")).not.toBeInTheDocument();
  });
});
