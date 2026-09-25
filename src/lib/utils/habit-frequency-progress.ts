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

// True for a Boolean "every D days" habit (count=1, D>1) — these show last-done/next instead of a ring.
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

export type LastDoneNext =
  | { kind: "never_done" }
  | { kind: "done_ago"; daysDone: number; daysNext: number }
  | { kind: "late"; daysLate: number };

export function getLastDoneNext(
  habit: Pick<Habit, "frequency_count" | "frequency_days" | "frequency_period">,
  entries: HabitEntry[],
  referenceDate: Date = new Date(),
): LastDoneNext {
  const windowDays = frequencyWindowDays(habit);
  const refKey = format(referenceDate, "yyyy-MM-dd");
  // Only count entries where value=1 (done); skipped (-2) and not-done (0) excluded.
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
  return { kind: "late", daysLate: -daysRemaining };
}

export function lastDoneNextLabel(metric: LastDoneNext): string {
  if (metric.kind === "never_done") return "Not done yet";
  if (metric.kind === "late")
    return `${metric.daysLate} day${metric.daysLate === 1 ? "" : "s"} late`;
  if (metric.daysNext === 0) return "Due today";
  const done =
    metric.daysDone === 0
      ? "Done today"
      : `Done ${metric.daysDone} day${metric.daysDone === 1 ? "" : "s"} ago`;
  return `${done} · next in ${metric.daysNext} day${metric.daysNext === 1 ? "" : "s"}`;
}

export function frequencyProgressLabel(progress: FrequencyProgress): string {
  const window =
    progress.windowDays === 1
      ? "today"
      : `in the last ${progress.windowDays} days`;
  return `${progress.completed} of ${progress.target} ${window}`;
}
