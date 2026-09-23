import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HabitMonthGrid } from "@/components/habits/insights/HabitMonthGrid";
import type { HabitWithEntries } from "@/lib/types/habit";
import * as useHabitMutationsModule from "@/lib/hooks/useHabitMutations";
import * as useCoarsePointerModule from "@/lib/hooks/useCoarsePointer";

vi.mock("@/lib/hooks/useHabitMutations");
vi.mock("@/lib/hooks/useCoarsePointer");

function makeHabit(overrides: Partial<HabitWithEntries>): HabitWithEntries {
  return {
    id: "h1",
    user_id: "u1",
    name: "Read",
    description: null,
    color: "#3b82f6",
    icon: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    start_date: "2026-05-20",
    sort_order: 0,
    habit_type: "boolean",
    entries: [],
    ...overrides,
  };
}

describe("HabitMonthGrid", () => {
  const mutate = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-11T10:00:00"));
    mutate.mockReset();
    vi.mocked(useHabitMutationsModule.useMarkHabitComplete).mockReturnValue({
      mutate,
    } as unknown as ReturnType<
      typeof useHabitMutationsModule.useMarkHabitComplete
    >);
    vi.mocked(useCoarsePointerModule.useCoarsePointer).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the current month on open with next and today disabled", () => {
    render(<HabitMonthGrid habit={makeHabit({})} />);
    const month = screen.getByRole("group");
    expect(month).toHaveAttribute("aria-label", "June 2026");
    expect(
      within(month).getByRole("button", {
        name: "Thursday Jun 11, not logged",
      }),
    ).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    const nextBtn = screen.getByRole("button", { name: "Next month" });
    const todayBtn = screen.getByRole("button", { name: "Today" });

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();
    expect(todayBtn).toBeDisabled();
  });

  it("navigates to earlier months with previous button and stops at start date", () => {
    render(<HabitMonthGrid habit={makeHabit({ start_date: "2026-05-20" })} />);
    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    const nextBtn = screen.getByRole("button", { name: "Next month" });
    const todayBtn = screen.getByRole("button", { name: "Today" });

    fireEvent.click(prevBtn);

    const month = screen.getByRole("group");
    expect(month).toHaveAttribute("aria-label", "May 2026");
    expect(todayBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
    expect(prevBtn).toBeDisabled();
  });

  it("jumps back to current month when clicking Today", () => {
    render(<HabitMonthGrid habit={makeHabit({ start_date: "2026-04-10" })} />);
    const prevBtn = screen.getByRole("button", { name: "Previous month" });
    const todayBtn = screen.getByRole("button", { name: "Today" });

    fireEvent.click(prevBtn);
    expect(screen.getByRole("group")).toHaveAttribute("aria-label", "May 2026");

    fireEvent.click(todayBtn);
    expect(screen.getByRole("group")).toHaveAttribute(
      "aria-label",
      "June 2026",
    );
    expect(todayBtn).toBeDisabled();
  });

  it("navigates months via touch swipe gestures", () => {
    const { container } = render(
      <HabitMonthGrid habit={makeHabit({ start_date: "2026-05-20" })} />,
    );
    const swipeTarget = container.firstChild as HTMLElement;

    fireEvent.touchStart(swipeTarget, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchEnd(swipeTarget, {
      changedTouches: [{ clientX: 250, clientY: 100 }],
    });

    expect(screen.getByRole("group")).toHaveAttribute("aria-label", "May 2026");

    fireEvent.touchStart(swipeTarget, {
      touches: [{ clientX: 250, clientY: 100 }],
    });
    fireEvent.touchEnd(swipeTarget, {
      changedTouches: [{ clientX: 100, clientY: 100 }],
    });

    expect(screen.getByRole("group")).toHaveAttribute(
      "aria-label",
      "June 2026",
    );
  });

  it("makes future days inert", () => {
    render(<HabitMonthGrid habit={makeHabit({})} />);
    expect(screen.queryByRole("button", { name: /Jun 12,/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Jun 30,/ })).toBeNull();
  });

  it("makes days before the start date inert", () => {
    render(<HabitMonthGrid habit={makeHabit({ start_date: "2026-05-20" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.queryByRole("button", { name: /May 19,/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Wednesday May 20, not logged" }),
    ).toBeInTheDocument();
  });

  it("cycles a tapped past day with that day's date", () => {
    render(
      <HabitMonthGrid
        habit={makeHabit({
          entries: [
            {
              id: "e1",
              habit_id: "h1",
              date: "2026-06-05",
              value: 1,
              created_at: "2026-06-05T00:00:00.000Z",
            },
          ],
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Friday Jun 5, done" }));
    expect(mutate).toHaveBeenCalledWith({
      habitId: "h1",
      date: "2026-06-05",
      value: -2,
    });
  });
});
