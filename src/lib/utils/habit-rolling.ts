import { format, subDays } from "date-fns";
import type { HabitEntry } from "@/lib/types/habit";

export interface RollingDay {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Narrow weekday letter (M T W T F S S) */
  weekdayLabel: string;
  /** Entry value for the day; 0 when there is no entry */
  value: number;
  /** True for the rightmost cell (today) */
  isToday: boolean;
  /** True for days before the habit's start_date (inert) */
  isBeforeStart: boolean;
}

/**
 * Build the rolling 7-day window ending at `today` (today last), with a
 * per-day descriptor for the compact strip. Days before `startDate` are
 * flagged inert; absent entries read as value 0.
 */
export function getRolling7Days(
  entries: HabitEntry[],
  today: Date,
  startDate: string | null,
): RollingDay[] {
  const valueByDate = new Map(entries.map((e) => [e.date, e.value]));
  // A null start_date (legacy / imported / direct-insert rows) means no
  // before-start cutoff — every day in the window is active.
  const startDay = startDate ? startDate.slice(0, 10) : null;
  const todayStr = format(today, "yyyy-MM-dd");

  return Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      date: dateStr,
      weekdayLabel: format(date, "EEEEE"),
      value: valueByDate.get(dateStr) ?? 0,
      isToday: dateStr === todayStr,
      isBeforeStart: startDay !== null && dateStr < startDay,
    };
  });
}
