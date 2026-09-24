import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
import type { HabitEntry } from "@/lib/hooks/useHabits";
import { ENTRY_VALUE_SKIPPED } from "@/lib/types/habit";

describe("HabitHeatmap Scroll Behavior", () => {
  let mockEntries: HabitEntry[];
  const startDate = "2025-01-20";
  const color = "#3b82f6";

  beforeEach(() => {
    mockEntries = [];
    const today = new Date();
    for (let i = 0; i <= 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (365 - i));
      mockEntries.push({
        id: `entry-${i}`,
        habit_id: "habit-1",
        date: date.toISOString().split("T")[0],
        value: 1,
        created_at: today.toISOString(),
      });
    }
  });

  it("should render with fit-content width to ensure correct overflow behavior", () => {
    const { container } = render(
      <HabitHeatmap
        entries={mockEntries}
        color={color}
        startDate={startDate}
      />,
    );

    const wrapper = container.firstChild as HTMLElement;

    expect(wrapper).toBeTruthy();
    expect(wrapper.style.width).toBe("fit-content");
  });

  it("renders a skipped day as an empty block instead of throwing", () => {
    const skipped = mockEntries[300];
    skipped.value = ENTRY_VALUE_SKIPPED;

    const { container } = render(
      <HabitHeatmap
        entries={mockEntries}
        color={color}
        startDate={startDate}
      />,
    );

    const block = container.querySelector(`rect[data-date="${skipped.date}"]`);
    expect(block?.getAttribute("data-level")).toBe("0");
  });

  it("outlines a skipped day in the habit color, unlike an empty day", () => {
    const skipped = mockEntries[300];
    skipped.value = ENTRY_VALUE_SKIPPED;
    const empty = mockEntries.splice(301, 1)[0];

    const { container } = render(
      <HabitHeatmap
        entries={mockEntries}
        color={color}
        startDate={startDate}
      />,
    );

    const strokeOf = (date: string) =>
      (container.querySelector(`rect[data-date="${date}"]`) as SVGElement).style
        .stroke;
    expect(strokeOf(skipped.date)).not.toBe(strokeOf(empty.date));
    expect(strokeOf(skipped.date)).toMatch(/#3b82f6|rgb\(59, 130, 246\)/);
  });
});

describe("HabitHeatmap shading", () => {
  const color = "#3b82f6";
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split("T")[0];
  };
  const entry = (date: string, value: number): HabitEntry => ({
    id: date,
    habit_id: "habit-1",
    date,
    value,
    created_at: date,
  });
  const levelOf = (container: HTMLElement, date: string) =>
    container
      .querySelector(`rect[data-date="${date}"]`)
      ?.getAttribute("data-level");

  it("shades Boolean Habit entries exactly as before", () => {
    const entries = [
      entry(daysAgo(3), 1),
      entry(daysAgo(2), 0),
      entry(daysAgo(1), ENTRY_VALUE_SKIPPED),
    ];

    for (const habit of [undefined, { habit_type: "boolean" as const }]) {
      const { container, unmount } = render(
        <HabitHeatmap entries={entries} color={color} habit={habit} />,
      );
      expect(levelOf(container, daysAgo(3))).toBe("4");
      expect(levelOf(container, daysAgo(2))).toBe("0");
      expect(levelOf(container, daysAgo(1))).toBe("0");
      unmount();
    }
  });

  it("shades a Measurable Habit by progress toward its target", () => {
    const habit = {
      habit_type: "measurable" as const,
      target_type: "at_least" as const,
      target_value: 10,
    };
    const entries = [
      entry(daysAgo(4), 1),
      entry(daysAgo(3), 8),
      entry(daysAgo(2), 10),
      entry(daysAgo(1), 20),
    ];

    const { container } = render(
      <HabitHeatmap entries={entries} color={color} habit={habit} />,
    );

    const barelyStarted = levelOf(container, daysAgo(4));
    const belowTarget = levelOf(container, daysAgo(3));
    const atTarget = levelOf(container, daysAgo(2));
    const overTarget = levelOf(container, daysAgo(1));

    expect(barelyStarted).toBe("1");
    expect(belowTarget).not.toBe(overTarget);
    expect(belowTarget).not.toBe(atTarget);
    expect(atTarget).toBe("4");
    expect(overTarget).toBe("4");
  });
});
