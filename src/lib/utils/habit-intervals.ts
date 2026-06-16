import { format, addDays, startOfDay } from "date-fns";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { periodDays } from "@/lib/utils/habit-score";

/**
 * Interpolates done-days from the frequency schedule.
 * For daily habits (1/1), returns the raw done-set (identity).
 * For sub-daily habits (e.g. 3×/week), fills the off-days implied by
 * the schedule using uhabits' interval algorithm.
 */
export function interpolateDoneDays(
  habit: Habit,
  entries: HabitEntry[],
  today: Date = new Date(),
): Set<string> {
  const doneDates = entries
    .filter((e) => e.value >= 1)
    .map((e) => e.date)
    .sort();

  if (doneDates.length === 0) return new Set();

  const freqCount = habit.frequency_count ?? 1;
  const period = periodDays(habit.frequency_period ?? null);

  // Daily habit: no interpolation needed
  if (freqCount === 1 && period === 1) {
    return new Set(doneDates);
  }

  // Frequency interpolation: build intervals from done-reps
  const todayKey = format(startOfDay(today), "yyyy-MM-dd");
  const intervals: [string, string][] = [];

  // Each window of `freqCount` reps within `period` days anchors an interval
  for (let i = 0; i <= doneDates.length - freqCount; i++) {
    const windowStart = doneDates[i];
    const windowEnd = doneDates[i + freqCount - 1];

    // Check if all freqCount reps fit within `period` days
    const startD = new Date(windowStart + "T00:00:00");
    const endD = new Date(windowEnd + "T00:00:00");
    const daySpan = (endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24);

    if (daySpan < period) {
      // Anchor interval: from windowStart, extending `period` days, clamped to today
      const intervalEnd = format(
        new Date(
          Math.min(
            addDays(startD, period - 1).getTime(),
            startOfDay(today).getTime(),
          ),
        ),
        "yyyy-MM-dd",
      );
      intervals.push([windowStart, intervalEnd]);
    }
  }

  // Snap overlapping/adjacent intervals together
  const snapped = snapIntervals(intervals);

  // Union of all interval days
  const result = new Set<string>();
  for (const [start, end] of snapped) {
    let cursor = new Date(start + "T00:00:00");
    const endDate = new Date(end + "T00:00:00");
    while (cursor <= endDate) {
      const key = format(cursor, "yyyy-MM-dd");
      if (key <= todayKey) {
        result.add(key);
      }
      cursor = addDays(cursor, 1);
    }
  }

  return result;
}

function snapIntervals(intervals: [string, string][]): [string, string][] {
  if (intervals.length === 0) return [];

  // Sort by start date
  const sorted = [...intervals].sort((a, b) => a[0].localeCompare(b[0]));
  const snapped: [string, string][] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = snapped[snapped.length - 1];
    const curr = sorted[i];

    // Overlapping or adjacent: merge
    if (curr[0] <= addOneDay(prev[1])) {
      if (curr[1] > prev[1]) {
        prev[1] = curr[1];
      }
    } else {
      snapped.push(curr);
    }
  }

  return snapped;
}

function addOneDay(dateStr: string): string {
  return format(addDays(new Date(dateStr + "T00:00:00"), 1), "yyyy-MM-dd");
}
