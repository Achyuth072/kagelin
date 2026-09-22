import { format, subDays } from "date-fns";
import type { HabitEntry } from "@/lib/types/habit";

export interface RollingDay {
  date: string;
  weekdayLabel: string;
  value: number;
  /** Distinguishes an explicit 0 from an unlogged day. */
  hasEntry: boolean;
  isToday: boolean;
  isBeforeStart: boolean;
}

export function getRolling7Days(
  entries: HabitEntry[],
  today: Date,
  startDate: string | null,
): RollingDay[] {
  const valueByDate = new Map(entries.map((e) => [e.date, e.value]));
  // Null start_date (legacy/imported rows) has no before-start cutoff.
  const startDay = startDate ? startDate.slice(0, 10) : null;
  const todayStr = format(today, "yyyy-MM-dd");

  return Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      date: dateStr,
      weekdayLabel: format(date, "EEEEE"),
      value: valueByDate.get(dateStr) ?? 0,
      hasEntry: valueByDate.has(dateStr),
      isToday: dateStr === todayStr,
      isBeforeStart: startDay !== null && dateStr < startDay,
    };
  });
}
