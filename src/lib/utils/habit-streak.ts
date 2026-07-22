import {
  format,
  startOfDay,
  subDays,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { interpolateDoneDays } from "@/lib/utils/habit-intervals";
import { dayValue, periodDays } from "@/lib/utils/habit-score";

/** Measurable habits interpolate nothing, so they keep the one-day window. */
function pendingWindowDays(
  habit: Pick<Habit, "frequency_period" | "habit_type">,
): number {
  if (habit.habit_type === "measurable") return 1;
  return periodDays(habit.frequency_period ?? null);
}

/**
 * Current unbroken run of done-days ending at the present.
 *
 * For daily boolean habits: identical to the original algorithm.
 * For frequency-aware habits: runs over the interpolated done-set.
 * For measurable habits: counts only logged days meeting target (no interpolation).
 *
 * The trailing gap up to today is _pending_, not a break, for one pending
 * window — a frequency Habit's interpolated run legitimately ends before today
 * while the current period is still open. See ADR 0004.
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
  if (done.size === 0) return 0;

  const key = (d: Date) => format(d, "yyyy-MM-dd");
  const todayStart = startOfDay(today);
  const window = pendingWindowDays(habit);

  let cursor: Date | null = null;
  for (let gap = 0; gap <= window; gap++) {
    const day = subDays(todayStart, gap);
    if (done.has(key(day))) {
      cursor = day;
      break;
    }
  }
  if (!cursor) return 0;

  let streak = 0;
  while (done.has(key(cursor))) {
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
 * Total completions: count of logged Entries that meet target.
 *
 * Per the domain spec, this counts only days with a real logged entry meeting
 * target — NOT interpolated/filled off-days, which would inflate the count for
 * frequency-aware habits and diverge from the habit card's raw completion count.
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
  _today: Date = new Date(),
): number {
  if (habit.habit_type === "measurable") {
    return entries.filter((e) => dayValue(e.value, habit) >= 1).length;
  }
  return entries.filter((e) => e.value >= 1).length;
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
    // Measurable: Boolean-only, no interpolation. Use the shared dayValue
    // predicate so the Score engine, Overview, and Frequency grid agree on
    // "done" — and so a null/0 target can't mark every logged day (incl. value 0)
    // as complete via the old `value >= (target ?? 0)` shortcut.
    const done = new Set<string>();
    for (const e of entries) {
      if (dayValue(e.value, habit) >= 1) {
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
