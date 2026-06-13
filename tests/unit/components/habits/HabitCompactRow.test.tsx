import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HabitCompactRow } from "@/components/habits/HabitCompactRow";
import type { HabitWithEntries } from "@/lib/types/habit";
import * as useHabitMutationsModule from "@/lib/hooks/useHabitMutations";
import * as useCoarsePointerModule from "@/lib/hooks/useCoarsePointer";

vi.mock("@/lib/hooks/useHabitMutations");
vi.mock("@/lib/hooks/useCoarsePointer");

describe("HabitCompactRow rolling-7 strip", () => {
  let mockHabit: HabitWithEntries;
  let yesterdayStr: string;

  beforeEach(() => {
    vi.mocked(useHabitMutationsModule.useMarkHabitComplete).mockReturnValue({
      mutate: vi.fn(),
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

  it("renders a fixed 7-cell strip (one column per day, no scroll)", () => {
    const { container } = render(<HabitCompactRow habit={mockHabit} />);
    const strip = container.querySelector(".grid-cols-7");
    expect(strip).toBeTruthy();
    expect(strip).not.toHaveClass("overflow-x-auto");
    expect(strip?.children).toHaveLength(7);
  });

  it("renders days before start_date as inert (no toggle button)", () => {
    const { container } = render(<HabitCompactRow habit={mockHabit} />);
    // start_date is yesterday → only yesterday + today are active buttons; the
    // five earlier days render as inert transparent placeholders.
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
    // No inert placeholders — every one of the 7 days is an active button.
    expect(container.querySelectorAll("button")).toHaveLength(7);
    expect(container.querySelectorAll(".bg-transparent")).toHaveLength(0);
  });
});
