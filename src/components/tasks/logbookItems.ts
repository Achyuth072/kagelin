import {
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import type { Task } from "@/lib/types/task";

export type LogbookItem =
  | { type: "header"; title: string; id: string }
  | { type: "task"; task: Task; id: string }
  | { type: "more"; count: number; id: string };

// A year of history is too long to scroll; older tasks wait behind
// "Show older" (search still covers them).
const RECENT_DAYS = 30;

function groupTitle(date: Date, now: Date, weekStart: Date): string {
  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, subDays(now, 1))) return "Yesterday";
  if (isAfter(date, weekStart)) return "This Week";
  return format(date, "MMMM yyyy");
}

export function buildLogbookItems(
  tasks: Task[],
  { now = new Date(), showOlder }: { now?: Date; showOlder: boolean },
): LogbookItem[] {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const cutoff = subDays(now, RECENT_DAYS);
  const dated = tasks
    .filter((task) => task.completed_at)
    .map((task) => ({ task, date: parseISO(task.completed_at!) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const shown = showOlder
    ? dated
    : dated.filter(({ date }) => isAfter(date, cutoff));

  const items: LogbookItem[] = [];
  let lastTitle = "";
  for (const { task, date } of shown) {
    const title = groupTitle(date, now, weekStart);
    if (title !== lastTitle) {
      items.push({ type: "header", title, id: `header-${title}` });
      lastTitle = title;
    }
    items.push({ type: "task", task, id: task.id });
  }

  const hidden = dated.length - shown.length;
  if (hidden > 0) items.push({ type: "more", count: hidden, id: "more" });
  return items;
}
