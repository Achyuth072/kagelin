import {
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subDays,
} from "date-fns";
import type { HabitEntry } from "@/lib/types/habit";

export interface RollingDay {
  date: string;
  weekdayLabel: string;
  value: number;
  /** Distinguishes an explicit 0 from an unlogged day. */
  hasEntry: boolean;
  isToday: boolean;
  isBeforeStart: boolean;
  isFuture: boolean;
}

const valueMaps = new WeakMap<HabitEntry[], Map<string, number>>();
function valuesByDate(entries: HabitEntry[]): Map<string, number> {
  let map = valueMaps.get(entries);
  if (!map) {
    map = new Map(entries.map((e) => [e.date, e.value]));
    valueMaps.set(entries, map);
  }
  return map;
}

function describeDays(
  dates: Date[],
  entries: HabitEntry[],
  today: Date,
  startDate: string | null,
): RollingDay[] {
  const valueByDate = valuesByDate(entries);
  // Null start_date (legacy/imported rows) has no before-start cutoff.
  const startDay = startDate ? startDate.slice(0, 10) : null;
  const todayStr = format(today, "yyyy-MM-dd");

  return dates.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      date: dateStr,
      weekdayLabel: format(date, "EEEEE"),
      value: valueByDate.get(dateStr) ?? 0,
      hasEntry: valueByDate.has(dateStr),
      isToday: dateStr === todayStr,
      isBeforeStart: startDay !== null && dateStr < startDay,
      isFuture: dateStr > todayStr,
    };
  });
}

export function getRolling7Days(
  entries: HabitEntry[],
  today: Date,
  startDate: string | null,
): RollingDay[] {
  const dates = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
  return describeDays(dates, entries, today, startDate);
}

export function getMonthDays(
  entries: HabitEntry[],
  dayInMonth: Date,
  today: Date,
  startDate: string | null,
): RollingDay[] {
  const dates = eachDayOfInterval({
    start: startOfMonth(dayInMonth),
    end: endOfMonth(dayInMonth),
  });
  return describeDays(dates, entries, today, startDate);
}
