import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { currentScore, dayValue, isLoggedEntry } from "@/lib/utils/habit-score";
import { getCurrentStreak } from "@/lib/utils/habit-streak";

export const COLD_START_HISTORY_DAYS = 14;

export interface HabitTrend {
  value: number;
  isPositive: boolean;
}

export interface MeasurableOverviewMetrics {
  score: number;
  scoreTrend?: HabitTrend;
  targetMetRate: {
    title: "Target Met Rate" | "Days Logged";
    value: string;
  };
  thirtyDayAverage: string;
  totalVolume: string;
}

/**
 * Formats the habit schedule frequency into a human-readable label
 * (e.g. "Daily", "3× / week", "Every 14 days", "3× / 14 days").
 */
export function formatHabitFrequencyLabel(
  habit: Pick<Habit, "frequency_count" | "frequency_days" | "frequency_period">,
): string {
  const count = habit.frequency_count ?? 1;
  const days = habit.frequency_days;
  const period = habit.frequency_period;

  if (days != null && days > 1) {
    return count === 1 ? `Every ${days} days` : `${count}× / ${days} days`;
  }

  if (period === "week" || days === 7) {
    return `${count}× / week`;
  }

  if (period === "month" || days === 30) {
    return `${count}× / month`;
  }

  if (count === 1) {
    return "Daily";
  }

  return `${count}× / day`;
}

/**
 * Checks whether a habit has accumulated at least 14 days of history.
 * Suppresses trend deltas when history is shorter than 14 days to prevent
 * volatile initial swings on newly created habits.
 */
export function hasSufficientHistory(
  habit: Pick<Habit, "start_date">,
  entries: HabitEntry[],
  referenceDate: Date = new Date(),
): boolean {
  if (entries.length === 0) return false;

  const earliestEntryDate = entries.reduce(
    (min, e) => (e.date < min ? e.date : min),
    entries[0].date,
  );

  const startDateStr =
    habit.start_date && habit.start_date < earliestEntryDate
      ? habit.start_date
      : earliestEntryDate;

  return (
    differenceInCalendarDays(referenceDate, parseISO(startDateStr)) >=
    COLD_START_HISTORY_DAYS
  );
}

/**
 * Calculates the 30-day rolling trend delta for habit score in percentage points.
 * Returns undefined if habit history is under 14 days.
 */
export function calculateScoreTrend(
  habit: Habit,
  entries: HabitEntry[],
  referenceDate: Date = new Date(),
): HabitTrend | undefined {
  if (!hasSufficientHistory(habit, entries, referenceDate)) {
    return undefined;
  }

  const scoreNow = Math.round(
    currentScore(habit, entries, { to: referenceDate }) * 100,
  );
  const score30DaysAgo = Math.round(
    currentScore(habit, entries, { to: subDays(referenceDate, 30) }) * 100,
  );
  const delta = scoreNow - score30DaysAgo;

  return {
    value: Math.abs(delta),
    isPositive: delta >= 0,
  };
}

/**
 * Calculates the 30-day rolling trend delta for current streak in days.
 * Returns undefined if habit history is under 14 days.
 */
export function calculateStreakTrend(
  habit: Habit,
  entries: HabitEntry[],
  referenceDate: Date = new Date(),
): HabitTrend | undefined {
  if (!hasSufficientHistory(habit, entries, referenceDate)) {
    return undefined;
  }

  const streakNow = getCurrentStreak(habit, entries, referenceDate);
  const streak30DaysAgo = getCurrentStreak(
    habit,
    entries,
    subDays(referenceDate, 30),
  );
  const delta = streakNow - streak30DaysAgo;

  return {
    value: Math.abs(delta),
    isPositive: delta >= 0,
  };
}

/**
 * Calculates balanced 4-card overview metrics for measurable habits:
 * 1. Score (with 30-day trend)
 * 2. Target Met Rate (% of logged days meeting target, fallback to Days Logged)
 * 3. 30-Day Average (daily average over 30 days rounded to 1 decimal place with unit)
 * 4. Total Volume (cumulative sum across history with unit)
 */
export function calculateMeasurableOverviewMetrics(
  habit: Habit,
  entries: HabitEntry[],
  referenceDate: Date = new Date(),
): MeasurableOverviewMetrics {
  const score = Math.round(
    currentScore(habit, entries, { to: referenceDate }) * 100,
  );
  const scoreTrend = calculateScoreTrend(habit, entries, referenceDate);

  const loggedEntries = entries.filter((e) => isLoggedEntry(e.value));
  const hasTarget = habit.target_value != null;

  let targetMetRate: {
    title: "Target Met Rate" | "Days Logged";
    value: string;
  };

  if (hasTarget) {
    const metCount = loggedEntries.filter(
      (e) => dayValue(e.value, habit) >= 1,
    ).length;
    const rate =
      loggedEntries.length > 0
        ? Math.round((metCount / loggedEntries.length) * 100)
        : 0;
    targetMetRate = {
      title: "Target Met Rate",
      value: `${rate}%`,
    };
  } else {
    targetMetRate = {
      title: "Days Logged",
      value: loggedEntries.length.toString(),
    };
  }

  // 30-day rolling window for daily average
  const startDateStr = format(subDays(referenceDate, 29), "yyyy-MM-dd");
  const endDateStr = format(referenceDate, "yyyy-MM-dd");
  const windowEntries = entries.filter(
    (e) =>
      e.date >= startDateStr &&
      e.date <= endDateStr &&
      isLoggedEntry(e.value) &&
      e.value > 0,
  );
  const windowSum = windowEntries.reduce((sum, e) => sum + e.value, 0);
  const avg = Math.round((windowSum / 30) * 10) / 10;
  const unitSuffix = habit.unit ? ` ${habit.unit}` : "";
  const thirtyDayAverage = `${avg}${unitSuffix}`;

  // Cumulative volume across all history
  const totalSum = loggedEntries.reduce(
    (sum, e) => sum + (e.value > 0 ? e.value : 0),
    0,
  );
  const roundedTotal = Math.round(totalSum * 10) / 10;
  const totalVolume = `${roundedTotal}${unitSuffix}`;

  return {
    score,
    scoreTrend,
    targetMetRate,
    thirtyDayAverage,
    totalVolume,
  };
}
