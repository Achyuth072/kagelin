import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { dayValue } from "@/lib/utils/habit-score";

export interface FrequencyProgress {
  completed: number;
  target: number;
  period: "day" | "week" | "month";
}

/**
 * Whether a Habit carries a *non-trivial* Frequency target worth surfacing as a
 * ring. Every Habit is implicitly daily (`1 / day`); that resting default is
 * redundant next to the done/not-done toggle, so the ring is shown only when the
 * target is more than once a day or spans a longer period. See CONTEXT.md
 * "Frequency progress".
 */
export function hasFrequencyTarget(
  habit: Pick<Habit, "frequency_count" | "frequency_period">,
): boolean {
  const count = habit.frequency_count ?? 1;
  const period = habit.frequency_period ?? "day";
  return count > 1 || period !== "day";
}

/**
 * A Habit's Frequency rendered as progress against the current period
 * (day/week/month), per CONTEXT.md "Frequency progress" — not a Goal.
 */
export function getFrequencyProgress(
  habit: Pick<
    Habit,
    | "habit_type"
    | "target_type"
    | "target_value"
    | "frequency_count"
    | "frequency_period"
  >,
  entries: HabitEntry[],
  referenceDate: Date = new Date(),
): FrequencyProgress {
  const target = habit.frequency_count ?? 1;
  const period = habit.frequency_period ?? "day";

  let windowStart: Date;
  let windowEnd: Date;
  switch (period) {
    case "week":
      windowStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      windowEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      break;
    case "month":
      windowStart = startOfMonth(referenceDate);
      windowEnd = endOfMonth(referenceDate);
      break;
    default:
      windowStart = referenceDate;
      windowEnd = referenceDate;
  }
  const startKey = format(windowStart, "yyyy-MM-dd");
  const endKey = format(windowEnd, "yyyy-MM-dd");

  let completed = 0;
  for (const e of entries) {
    if (e.date < startKey || e.date > endKey) continue;
    if (dayValue(e.value, habit) >= 1) completed++;
  }

  return { completed, target, period };
}

const PERIOD_LABELS: Record<FrequencyProgress["period"], string> = {
  day: "today",
  week: "this week",
  month: "this month",
};

/** Plain-language window for the sr-only ring description, e.g. "2 of 3 this week". */
export function frequencyProgressLabel(progress: FrequencyProgress): string {
  return `${progress.completed} of ${progress.target} ${PERIOD_LABELS[progress.period]}`;
}
