import { format, subDays } from "date-fns";
import type { Habit, HabitEntry } from "@/lib/types/habit";
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

export function frequencyProgressLabel(progress: FrequencyProgress): string {
  const window =
    progress.windowDays === 1
      ? "today"
      : `in the last ${progress.windowDays} days`;
  return `${progress.completed} of ${progress.target} ${window}`;
}
