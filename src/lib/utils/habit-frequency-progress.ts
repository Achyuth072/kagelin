import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { ENTRY_VALUE_DONE } from "@/lib/types/habit";
import { dayValue } from "@/lib/utils/habit-score";
import { frequencyWindowDays } from "@/lib/utils/habit-frequency";

export interface FrequencyProgress {
  completed: number;
  target: number;
  windowDays: number;
}

// Suppresses the ring for 1-in-1d habits to avoid redundancy with the toggle.
export function hasFrequencyTarget(
  habit: Pick<Habit, "frequency_count" | "frequency_days" | "frequency_period">,
): boolean {
  const count = habit.frequency_count ?? 1;
  return count > 1 || frequencyWindowDays(habit) !== 1;
}

export function getFrequencyProgress(
  habit: Pick<
    Habit,
    | "habit_type"
    | "target_type"
    | "target_value"
    | "frequency_count"
    | "frequency_days"
    | "frequency_period"
  >,
  entries: HabitEntry[],
  referenceDate: Date = new Date(),
): FrequencyProgress {
  const target = habit.frequency_count ?? 1;
  const windowDays = frequencyWindowDays(habit);

  const startKey = format(subDays(referenceDate, windowDays - 1), "yyyy-MM-dd");
  const endKey = format(referenceDate, "yyyy-MM-dd");

  let completed = 0;
  for (const e of entries) {
    if (e.date < startKey || e.date > endKey) continue;
    if (dayValue(e.value, habit) >= 1) completed++;
  }

  return { completed, target, windowDays };
}

export function isOnceEveryDDays(
  habit: Pick<
    Habit,
    "habit_type" | "frequency_count" | "frequency_days" | "frequency_period"
  >,
): boolean {
  if (habit.habit_type === "measurable") return false;
  const count = habit.frequency_count ?? 1;
  const days = frequencyWindowDays(habit);
  return count === 1 && days > 1;
}

export function showsFrequencyRing(
  habit: Pick<
    Habit,
    "habit_type" | "frequency_count" | "frequency_days" | "frequency_period"
  >,
): boolean {
  return (
    habit.habit_type !== "measurable" &&
    !isOnceEveryDDays(habit) &&
    hasFrequencyTarget(habit)
  );
}

export type LastDoneNext =
  | { kind: "never_done" }
  | { kind: "done_ago"; daysDone: number; daysNext: number }
  | { kind: "late"; daysDone: number; daysLate: number };

export function getLastDoneNext(
  habit: Pick<Habit, "frequency_count" | "frequency_days" | "frequency_period">,
  entries: HabitEntry[],
  referenceDate: Date = new Date(),
): LastDoneNext {
  const windowDays = frequencyWindowDays(habit);
  const refKey = format(referenceDate, "yyyy-MM-dd");
  const doneDates = entries
    .filter((e) => e.value === ENTRY_VALUE_DONE && e.date <= refKey)
    .map((e) => e.date)
    .sort();
  const lastDoneDate = doneDates.at(-1);
  if (!lastDoneDate) return { kind: "never_done" };

  const daysDone = differenceInCalendarDays(
    parseISO(refKey),
    parseISO(lastDoneDate),
  );
  const daysRemaining = windowDays - daysDone;

  if (daysRemaining >= 0) {
    return { kind: "done_ago", daysDone, daysNext: daysRemaining };
  }
  return { kind: "late", daysDone, daysLate: -daysRemaining };
}

function daysLabel(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

export function lastDoneNextLabel(metric: LastDoneNext): string {
  if (metric.kind === "never_done") return "Not done yet";
  const done =
    metric.daysDone === 0
      ? "Done today"
      : `Done ${daysLabel(metric.daysDone)} ago`;
  if (metric.kind === "late")
    return `${done} · ${daysLabel(metric.daysLate)} late`;
  if (metric.daysNext === 0) return `${done} · next today`;
  return `${done} · next in ${daysLabel(metric.daysNext)}`;
}

export function frequencyProgressLabel(progress: FrequencyProgress): string {
  const window =
    progress.windowDays === 1
      ? "today"
      : `in the last ${progress.windowDays} days`;
  return `${progress.completed} of ${progress.target} ${window}`;
}
