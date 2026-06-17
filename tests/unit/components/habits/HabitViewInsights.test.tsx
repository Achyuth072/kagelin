import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HabitCard } from "@/components/habits/HabitCard";
import { HabitCompactRow } from "@/components/habits/HabitCompactRow";
import type { HabitWithEntries } from "@/lib/types/habit";
import * as useIsMobileModule from "@/lib/hooks/useIsMobile";
import * as useHabitMutationsModule from "@/lib/hooks/useHabitMutations";
import * as useCoarsePointerModule from "@/lib/hooks/useCoarsePointer";

vi.mock("@/lib/hooks/useIsMobile");
vi.mock("@/lib/hooks/useHabitMutations");
vi.mock("@/lib/hooks/useCoarsePointer");

describe("View insights affordance", () => {
  let mockHabit: HabitWithEntries;

  beforeEach(() => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
    vi.mocked(useHabitMutationsModule.useMarkHabitComplete).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<
      typeof useHabitMutationsModule.useMarkHabitComplete
    >);
    vi.mocked(useCoarsePointerModule.useCoarsePointer).mockReturnValue(false);

    mockHabit = {
      id: "habit-test",
      user_id: "user-test",
      name: "Test Habit",
      description: null,
      color: "#3b82f6",
      icon: "Droplets",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
      start_date: null,
      sort_order: 0,
      entries: [],
    };
  });

  it("HabitCard: clicking View insights calls onViewInsights, not onEdit", () => {
    const onEdit = vi.fn();
    const onViewInsights = vi.fn();
    render(
      <HabitCard
        habit={mockHabit}
        onEdit={onEdit}
        onViewInsights={onViewInsights}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /view insights/i }));

    expect(onViewInsights).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("HabitCompactRow: clicking View insights calls onViewInsights, not onEdit", () => {
    const onEdit = vi.fn();
    const onViewInsights = vi.fn();
    render(
      <HabitCompactRow
        habit={mockHabit}
        onEdit={onEdit}
        onViewInsights={onViewInsights}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /view insights/i }));

    expect(onViewInsights).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
