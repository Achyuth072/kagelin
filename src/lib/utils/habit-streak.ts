import { format, startOfDay, subDays } from "date-fns";
import type { HabitEntry } from "@/lib/types/habit";

/**
 * Current unbroken run of done-days ending at the present.
 *
 * An unlogged today is _pending_, not a break: the streak counts through
 * yesterday and only breaks on a day that has already passed. So a live run
 * reads its true length all morning before today is logged.
 */
export function getCurrentStreak(
  entries: HabitEntry[],
  today: Date = new Date(),
): number {
  const done = new Set(entries.filter((e) => e.value === 1).map((e) => e.date));

  let cursor = startOfDay(today);
  // Pending today: start the walk-back from yesterday so it doesn't read as a break.
  if (!done.has(format(cursor, "yyyy-MM-dd"))) {
    cursor = subDays(cursor, 1);
  }

  let streak = 0;
  while (done.has(format(cursor, "yyyy-MM-dd"))) {
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
}
