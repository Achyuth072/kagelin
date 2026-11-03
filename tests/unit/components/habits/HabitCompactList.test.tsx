import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { format } from "date-fns";
import { HabitCompactList } from "@/components/habits/HabitCompactList";
import type { HabitWithEntries } from "@/lib/types/habit";
import * as useHabitMutationsModule from "@/lib/hooks/useHabitMutations";
import * as useUiStoreModule from "@/lib/store/uiStore";
import * as useCoarsePointerModule from "@/lib/hooks/useCoarsePointer";

vi.mock("@/lib/hooks/useHabitMutations");
vi.mock("@/lib/store/uiStore");
vi.mock("@/lib/hooks/useCoarsePointer");

describe("HabitCompactList", () => {
  let mockHabits: HabitWithEntries[];
  const onEditHabit = vi.fn();
  const onViewInsights = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUiStoreModule.useUiStore).mockImplementation((selector) =>
      selector({ isDesktop: true } as unknown as Parameters<
        typeof selector
      >[0]),
    );
    vi.mocked(useHabitMutationsModule.useReorderHabits).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<
      typeof useHabitMutationsModule.useReorderHabits
    >);
    vi.mocked(useHabitMutationsModule.useMarkHabitComplete).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<
      typeof useHabitMutationsModule.useMarkHabitComplete
    >);
    vi.mocked(useCoarsePointerModule.useCoarsePointer).mockReturnValue(false);

    const todayStr = format(new Date(), "yyyy-MM-dd");

    mockHabits = [
      {
        id: "h1",
        user_id: "user-1",
        name: "Morning Meditation",
        description: null,
        color: "#4B6CB7",
        icon: "Droplets",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
        start_date: todayStr,
        sort_order: 0,
        entries: [
          {
            id: "e1",
            habit_id: "h1",
            date: todayStr,
            value: 1,
            created_at: new Date().toISOString(),
          },
        ],
      },
      {
        id: "h2",
        user_id: "user-1",
        name: "Read 20 Pages",
        description: null,
        color: "#839B82",
        icon: "Book",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
        start_date: todayStr,
        sort_order: 1,
        entries: [],
      },
    ];
  });

  it("renders the synchronized timeline header with completion stats", () => {
    render(
      <HabitCompactList
        habits={mockHabits}
        onEditHabit={onEditHabit}
        onViewInsights={onViewInsights}
      />,
    );

    expect(screen.getByText("Habits")).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 done today/i)).toBeInTheDocument();
  });

  it("renders all habit rows in the list", () => {
    render(
      <HabitCompactList
        habits={mockHabits}
        onEditHabit={onEditHabit}
        onViewInsights={onViewInsights}
      />,
    );

    expect(screen.getByText("Morning Meditation")).toBeInTheDocument();
    expect(screen.getByText("Read 20 Pages")).toBeInTheDocument();
  });

  it("triggers onEditHabit when a habit row is clicked", () => {
    render(
      <HabitCompactList
        habits={mockHabits}
        onEditHabit={onEditHabit}
        onViewInsights={onViewInsights}
      />,
    );

    fireEvent.click(screen.getByText("Morning Meditation"));
    expect(onEditHabit).toHaveBeenCalledWith(mockHabits[0]);
  });

  it("triggers onViewInsights when the insights button is clicked", () => {
    render(
      <HabitCompactList
        habits={mockHabits}
        onEditHabit={onEditHabit}
        onViewInsights={onViewInsights}
      />,
    );

    const insightButtons = screen.getAllByRole("button", {
      name: /view insights/i,
    });
    expect(insightButtons.length).toBe(2);
    fireEvent.click(insightButtons[0]);
    expect(onViewInsights).toHaveBeenCalledWith(mockHabits[0]);
  });

  it("renders cleanly without onViewInsights prop", () => {
    render(<HabitCompactList habits={mockHabits} onEditHabit={onEditHabit} />);

    expect(
      screen.queryByRole("button", { name: /view insights/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Morning Meditation")).toBeInTheDocument();
  });
});
