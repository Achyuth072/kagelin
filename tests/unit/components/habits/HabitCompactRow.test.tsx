import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HabitCompactRow } from "@/components/habits/HabitCompactRow";
import type { HabitWithEntries } from "@/lib/types/habit";
import * as useHabitMutationsModule from "@/lib/hooks/useHabitMutations";
import * as useCoarsePointerModule from "@/lib/hooks/useCoarsePointer";

vi.mock("@/lib/hooks/useHabitMutations");
vi.mock("@/lib/hooks/useCoarsePointer");

describe("HabitCompactRow scroll initialization", () => {
  let mockHabit: HabitWithEntries;

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
    const yesterdayStr = yesterday.toISOString().split("T")[0];

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

  it("renders a scrollable rolling-7 strip container", () => {
    const { container } = render(<HabitCompactRow habit={mockHabit} />);
    const strip = container.querySelector(".overflow-x-auto");
    expect(strip).toBeTruthy();
  });

  it("pins the strip to the right end synchronously on mount (no rAF flash)", () => {
    const originalScrollWidthDesc = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "scrollWidth",
    );
    const originalScrollLeftDesc = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "scrollLeft",
    );

    let mockScrollLeft = 0;
    Object.defineProperty(Element.prototype, "scrollWidth", {
      configurable: true,
      get: () => 500,
    });
    Object.defineProperty(Element.prototype, "scrollLeft", {
      configurable: true,
      get: () => mockScrollLeft,
      set: (v: number) => {
        mockScrollLeft = v;
      },
    });

    // The scroll is set inside useLayoutEffect (before paint), which React runs
    // synchronously within render()'s act — no requestAnimationFrame needed.
    const { container, unmount } = render(
      <HabitCompactRow habit={mockHabit} />,
    );

    const strip = container.querySelector(".overflow-x-auto") as HTMLElement;
    expect(strip.scrollLeft).toBe(500);

    unmount();

    if (originalScrollWidthDesc) {
      Object.defineProperty(
        Element.prototype,
        "scrollWidth",
        originalScrollWidthDesc,
      );
    }
    if (originalScrollLeftDesc) {
      Object.defineProperty(
        Element.prototype,
        "scrollLeft",
        originalScrollLeftDesc,
      );
    }
  });
});
