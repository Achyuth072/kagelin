/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HabitsPage from "../../app/habits/page";
import { HabitsPageHeader } from "@/components/habits/HabitsPageHeader";
import { useHabits } from "@/lib/hooks/useHabits";

vi.mock("@/lib/hooks/useHabits", () => ({
  useHabits: vi.fn(),
}));

vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({
    openAddHabit: vi.fn(),
    openEditHabit: vi.fn(),
    openHabitInsights: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("HabitsPage header", () => {
  it("shows the Habits header when there are no habits", () => {
    (useHabits as any).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <HabitsPage />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Habits" })).toBeTruthy();
  });
});

describe("HabitsPageHeader", () => {
  function renderHeader(
    props?: Partial<Parameters<typeof HabitsPageHeader>[0]>,
  ) {
    const onViewModeChange = vi.fn();
    const onNewHabit = vi.fn();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <HabitsPageHeader
          viewMode="grid"
          onViewModeChange={onViewModeChange}
          onNewHabit={onNewHabit}
          {...props}
        />
      </QueryClientProvider>,
    );

    return { onViewModeChange, onNewHabit };
  }

  it("calls onViewModeChange when switching tabs", () => {
    const { onViewModeChange } = renderHeader();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /compact/i }));

    expect(onViewModeChange).toHaveBeenCalledWith("compact");
  });

  it("calls onNewHabit when the New Habit button is clicked", () => {
    const { onNewHabit } = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: /new habit/i }));

    expect(onNewHabit).toHaveBeenCalledTimes(1);
  });
});
