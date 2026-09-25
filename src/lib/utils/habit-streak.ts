import {
  format,
  startOfDay,
  subDays,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import {
  type Habit,
  type HabitEntry,
  ENTRY_VALUE_SKIPPED,
} from "@/lib/types/habit";
import { interpolateDoneDays } from "@/lib/utils/habit-intervals";
import { dayValue } from "@/lib/utils/habit-score";
import { frequencyWindowDays } from "@/lib/utils/habit-frequency";

// Measurable habits do not interpolate off-days.
function pendingWindowDays(
  habit: Pick<Habit, "frequency_days" | "frequency_period" | "habit_type">,
): number {
  if (habit.habit_type === "measurable") return 1;
  return frequencyWindowDays(habit);
}

// Trailing gap within pending window is treated as open, not broken (ADR 0004).
export function getCurrentStreak(
  habit: Pick<
    Habit,
    | "frequency_count"
    | "frequency_days"
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

export function getBestStreaks(
  habit: Pick<
    Habit,
    | "frequency_count"
    | "frequency_days"
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

// Excludes interpolated off-days to avoid inflating real completion counts.
export function getTotalCompletions(
  habit: Pick<
    Habit,
    | "frequency_count"
    | "frequency_days"
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
    | "frequency_days"
    | "frequency_period"
    | "habit_type"
    | "target_type"
    | "target_value"
  >,
  entries: HabitEntry[],
  today: Date,
): Set<string> {
  const todayKey = format(startOfDay(today), "yyyy-MM-dd");
  let done: Set<string>;

  if (habit.habit_type === "measurable") {
    // Uses dayValue to share target evaluation rules across score and streak engines.
    done = new Set<string>();
    for (const e of entries) {
      if (dayValue(e.value, habit) >= 1 && e.date <= todayKey) {
        done.add(e.date);
      }
    }
  } else {
    done = interpolateDoneDays(
      habit,
      entries.filter((e) => e.value >= 1),
      today,
    );
  }

  // Skipped entries bridge streaks without counting as completions (ADR 0004).
  for (const e of entries) {
    if (e.value === ENTRY_VALUE_SKIPPED && e.date <= todayKey) {
      done.add(e.date);
    }
  }

  return done;
}
