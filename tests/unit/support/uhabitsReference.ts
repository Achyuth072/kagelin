/**
 * Faithful TypeScript port of Loop Habit Tracker's boolean checkmark + streak
 * algorithm (uhabits-core `EntryList` / `StreakList`), for use as a differential
 * oracle in tests. Ported verbatim from:
 *   uhabits-core/src/commonMain/kotlin/org/isoron/uhabits/core/models/EntryList.kt
 *   uhabits-core/src/commonMain/kotlin/org/isoron/uhabits/core/models/StreakList.kt
 *
 * Dates are ISO "yyyy-MM-dd" strings. Month-length frequencies (den 30/31) are
 * not ported.
 */
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

const daysUntil = (a: string, b: string): number =>
  differenceInCalendarDays(parseISO(b), parseISO(a));
const shift = (d: string, n: number): string =>
  format(addDays(parseISO(d), n), "yyyy-MM-dd");

interface Interval {
  begin: string; // oldest day covered
  center: string; // the rep completing the required count
  end: string; // newest day covered
}

/** uhabits EntryList.buildIntervals — `entries` are done-day strings (any order). */
function buildIntervals(
  num: number,
  den: number,
  doneDates: string[],
): Interval[] {
  // uhabits processes reps newest-first.
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

/** uhabits EntryList.snapIntervalsTogether — slides intervals back to close gaps. */
function snapIntervalsTogether(intervals: Interval[]): void {
  for (let i = 1; i < intervals.length; i++) {
    const curr = intervals[i];
    const next = intervals[i - 1];
    const gapNextToCurrent = daysUntil(next.begin, curr.end);
    const gapCenterToEnd = daysUntil(curr.center, curr.end);
    if (gapNextToCurrent >= 0) {
      const s = Math.min(gapCenterToEnd, gapNextToCurrent + 1);
      intervals[i] = {
        begin: shift(curr.begin, -s),
        center: curr.center,
        end: shift(curr.end, -s),
      };
    }
  }
}

/** Boolean done-set: union of all interval days (== uhabits YES_AUTO/MANUAL days). */
export function computeDoneSet(
  num: number,
  den: number,
  doneDates: string[],
): Set<string> {
  const intervals = buildIntervals(num, den, doneDates);
  snapIntervalsTogether(intervals);
  const done = new Set<string>();
  for (const { begin, end } of intervals) {
    let cur = begin;
    while (cur <= end) {
      done.add(cur);
      cur = shift(cur, 1);
    }
  }
  return done;
}

/**
 * uhabits StreakList: the most recent streak = the unbroken run of done-days
 * ending at the newest done-day at/before `today`. There is NO requirement that
 * the run reach today — a run ending days ago is still reported at full length.
 */
export function currentStreak(doneSet: Set<string>, today: string): number {
  let cursor: string | null = null;
  for (const d of doneSet) {
    if (d <= today && (!cursor || d > cursor)) cursor = d;
  }
  if (!cursor) return 0;

  let streak = 0;
  while (doneSet.has(cursor)) {
    streak++;
    cursor = shift(cursor, -1);
  }
  return streak;
}
