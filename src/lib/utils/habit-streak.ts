import {
  format,
  startOfDay,
  subDays,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { interpolateDoneDays } from "@/lib/utils/habit-intervals";

/**
 * Current unbroken run of done-days ending at the present.
 *
 * For daily boolean habits: identical to the original algorithm.
 * For frequency-aware habits: runs over the interpolated done-set.
 * For measurable habits: counts only logged days meeting target (no interpolation).
 *
 * An unlogged today is _pending_, not a break: the streak counts through
 * yesterday and only breaks on a day that has already passed. So a live run
 * reads its true length all morning before today is logged.
 */
export function getCurrentStreak(
  habit: Pick<
    Habit,
    | "frequency_count"
    | "frequency_period"
    | "habit_type"
    | "target_type"
    | "target_value"
  >,
  entries: HabitEntry[],
  today: Date = new Date(),
): number {
  const done = buildDoneSet(habit, entries, today);

  let cursor = startOfDay(today);
  // Pending today: start the walk-back from yesterday so it doesn't read as a break.
  if (!done.has(format(cursor, "yyyy-MM-dd"))) {
    cursor = subDays(cursor, 1);
  }

  let streak = 0;
  while (done.has(format(cursor, "yyyy-MM-dd"))) {
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/**
 * Top N best (longest) streaks over the interpolated done-set.
 */
export function getBestStreaks(
  habit: Pick<
    Habit,
    | "frequency_count"
    | "frequency_period"
    | "habit_type"
    | "target_type"
    | "target_value"
  >,
  entries: HabitEntry[],
  topN: number = 5,
  today: Date = new Date(),
): number[] {
  const done = buildDoneSet(habit, entries, today);
  if (done.size === 0) return [];

  const sortedDays = [...done].sort();
  const runs: number[] = [];
  let prevDay = sortedDays[0];
  let runLen = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const gap = differenceInCalendarDays(
      parseISO(sortedDays[i]),
      parseISO(prevDay),
    );
    if (gap === 1) {
      runLen++;
    } else {
      runs.push(runLen);
      runLen = 1;
    }
    prevDay = sortedDays[i];
  }
  runs.push(runLen);

  return runs.sort((a, b) => b - a).slice(0, topN);
}

/**
 * Total completions: interpolated done-day count for boolean;
 * target-meeting logged-day count for measurable.
 */
export function getTotalCompletions(
  habit: Pick<
    Habit,
    | "frequency_count"
    | "frequency_period"
    | "habit_type"
    | "target_type"
    | "target_value"
  >,
  entries: HabitEntry[],
  today: Date = new Date(),
): number {
  return buildDoneSet(habit, entries, today).size;
}

function buildDoneSet(
  habit: Pick<
    Habit,
    | "frequency_count"
    | "frequency_period"
    | "habit_type"
    | "target_type"
    | "target_value"
  >,
  entries: HabitEntry[],
  today: Date,
): Set<string> {
  if (habit.habit_type === "measurable") {
    // Measurable: Boolean-only, no interpolation
    const target = habit.target_value ?? 0;
    const done = new Set<string>();
    for (const e of entries) {
      if (habit.target_type === "at_least" && e.value >= target) {
        done.add(e.date);
      } else if (habit.target_type === "at_most" && e.value <= target) {
        done.add(e.date);
      }
    }
    return done;
  }

  // Boolean: use frequency interpolation
  return interpolateDoneDays(
    habit,
    entries.filter((e) => e.value >= 1),
    today,
  );
}
