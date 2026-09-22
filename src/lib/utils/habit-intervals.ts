import {
  format,
  addDays,
  startOfDay,
  parseISO,
  differenceInCalendarDays,
} from "date-fns";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { periodDays } from "@/lib/utils/habit-score";

export interface Interval {
  begin: string; // oldest day covered
  center: string; // the rep completing the required count
  end: string; // newest day covered
}

const daysUntil = (a: string, b: string): number =>
  differenceInCalendarDays(parseISO(b), parseISO(a));

export const shift = (d: string, n: number): string =>
  format(addDays(parseISO(d), n), "yyyy-MM-dd");

// Ported verbatim from uhabits EntryList.buildIntervals.
export function buildIntervals(
  num: number,
  den: number,
  doneDates: string[],
): Interval[] {
  const filtered = [...doneDates].sort().reverse();
  const intervals: Interval[] = [];
  for (let i = num - 1; i < filtered.length; i++) {
    const begin = filtered[i];
    const center = filtered[i - num + 1];
    if (daysUntil(begin, center) < den) {
      intervals.push({ begin, center, end: shift(begin, den - 1) });
    }
  }
  return intervals;
}

// Slides intervals backwards in time to close gaps so streaks stay continuous.
// Ported verbatim from uhabits EntryList.snapIntervalsTogether.
export function snapIntervalsTogether(intervals: Interval[]): void {
  for (let i = 1; i < intervals.length; i++) {
    const curr = intervals[i];
    const next = intervals[i - 1];
    const gapNextToCurrent = daysUntil(next.begin, curr.end);
    const gapCenterToEnd = daysUntil(curr.center, curr.end);
    if (gapNextToCurrent >= 0) {
      const shiftDays = Math.min(gapCenterToEnd, gapNextToCurrent + 1);
      intervals[i] = {
        begin: shift(curr.begin, -shiftDays),
        center: curr.center,
        end: shift(curr.end, -shiftDays),
      };
    }
  }
}

function forwardMergeIntervals(
  intervals: [string, string][],
): [string, string][] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a[0].localeCompare(b[0]));
  const merged: [string, string][] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];

    if (curr[0] <= shift(prev[1], 1)) {
      if (curr[1] > prev[1]) {
        prev[1] = curr[1];
      }
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

// Fills the off-days implied by the frequency schedule (e.g. 3×/week) using
// uhabits' interval algorithm.
export function interpolateDoneDays(
  habit: Pick<Habit, "frequency_count" | "frequency_period">,
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

  if (freqCount === 1 && period === 1) {
    return new Set(doneDates);
  }

  const todayKey = format(startOfDay(today), "yyyy-MM-dd");
  const intervals = buildIntervals(freqCount, period, doneDates);
  snapIntervalsTogether(intervals);

  const rawIntervals: [string, string][] = intervals.map((inv) => [
    inv.begin,
    inv.end,
  ]);
  const merged = forwardMergeIntervals(rawIntervals);

  const result = new Set<string>();
  for (const [start, end] of merged) {
    let cursor = parseISO(start);
    const endDate = parseISO(end);
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
