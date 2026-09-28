import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HabitCompactRow } from "@/components/habits/HabitCompactRow";
import { ENTRY_VALUE_SKIPPED, type HabitWithEntries } from "@/lib/types/habit";
import * as useHabitMutationsModule from "@/lib/hooks/useHabitMutations";
import * as useCoarsePointerModule from "@/lib/hooks/useCoarsePointer";

vi.mock("@/lib/hooks/useHabitMutations");
vi.mock("@/lib/hooks/useCoarsePointer");

describe("HabitCompactRow rolling-7 strip", () => {
  let mockHabit: HabitWithEntries;
  let yesterdayStr: string;
  const mutate = vi.fn();

  beforeEach(() => {
    mutate.mockReset();
    vi.mocked(useHabitMutationsModule.useMarkHabitComplete).mockReturnValue({
      mutate,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<
      typeof useHabitMutationsModule.useMarkHabitComplete
    >);
    vi.mocked(useCoarsePointerModule.useCoarsePointer).mockReturnValue(false);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterdayStr = yesterday.toISOString().split("T")[0];

    mockHabit = {
      id: "habit-test",
      user_id: "user-test",
      name: "Test Habit",
      description: null,
      color: "#3b82f6",
      icon: "Droplets",
      created_at: today.toISOString(),
      updated_at: today.toISOString(),
      archived_at: null,
      start_date: yesterdayStr,
      sort_order: 0,
      entries: [
        {
          id: "e1",
          habit_id: "habit-test",
          date: yesterdayStr,
          value: 1,
          created_at: yesterday.toISOString(),
        },
      ],
    };
  });

  it("keeps the streak next to last done / next for a 1-in-D habit", () => {
    render(
      <HabitCompactRow
        habit={{ ...mockHabit, frequency_count: 1, frequency_days: 7 }}
      />,
    );
    expect(screen.getByText(/done 1 day ago/i)).toBeInTheDocument();
    expect(screen.getByText(/streak/)).toBeInTheDocument();
  });

  it("renders a fixed 7-cell strip (one column per day, no scroll)", () => {
    const { container } = render(<HabitCompactRow habit={mockHabit} />);
    const strip = container.querySelector(".grid-cols-7");
    expect(strip).toBeTruthy();
    expect(strip).not.toHaveClass("overflow-x-auto");
    expect(strip?.children).toHaveLength(7);
  });

  it("renders days before start_date as inert (no toggle button)", () => {
    const { container } = render(<HabitCompactRow habit={mockHabit} />);
    // start_date is yesterday: 2 active cells, 5 inert placeholders.
    expect(container.querySelectorAll("button")).toHaveLength(2);
    expect(container.querySelectorAll(".bg-transparent")).toHaveLength(5);
  });

  it("rings the rightmost (today) cell", () => {
    const { container } = render(<HabitCompactRow habit={mockHabit} />);
    const buttons = container.querySelectorAll("button");
    const todayButton = buttons[buttons.length - 1];
    expect(todayButton.querySelector(".ring-2")).toBeTruthy();
  });

  it("treats a null start_date as no before-start cutoff", () => {
    mockHabit.start_date = null;
    const { container } = render(<HabitCompactRow habit={mockHabit} />);
    expect(container.querySelectorAll("button")).toHaveLength(7);
    expect(container.querySelectorAll(".bg-transparent")).toHaveLength(0);
  });

  it("cycles a done day to skipped", () => {
    render(<HabitCompactRow habit={mockHabit} />);
    fireEvent.click(screen.getByRole("button", { name: /, done$/ }));
    expect(mutate).toHaveBeenCalledWith({
      habitId: mockHabit.id,
      date: yesterdayStr,
      value: ENTRY_VALUE_SKIPPED,
    });
  });

  it("returns an imported not-done day to not done on the third tap, across remounts", () => {
    const withValue = (value: number): HabitWithEntries => ({
      ...mockHabit,
      id: "habit-imported",
      entries: [{ ...mockHabit.entries[0], value }],
    });
    // start_date is yesterday, so the strip's first active cell is yesterday.
    const tapYesterdayOn = (value: number) => {
      const { unmount } = render(<HabitCompactRow habit={withValue(value)} />);
      fireEvent.click(screen.getAllByRole("button")[0]);
      unmount();
    };

    tapYesterdayOn(0);
    tapYesterdayOn(1);
    tapYesterdayOn(ENTRY_VALUE_SKIPPED);

    expect(mutate.mock.calls.map(([args]) => args.value)).toEqual([
      1,
      ENTRY_VALUE_SKIPPED,
      0,
    ]);
  });
});
