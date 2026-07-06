import { isAfter, parseISO, startOfDay } from "date-fns";
import type { Task } from "@/lib/types/task";

export type TaskOccurrence = Pick<
  Task,
  "due_date" | "completed_at" | "is_completed"
>;

type DatedOccurrence = TaskOccurrence & { due_date: string };

/**
 * Occurrences sorted oldest-first by due date, dropping any without one — an
 * Occurrence with no due date can't be placed in the sequence.
 */
function sortedByDueDate(occurrences: TaskOccurrence[]): DatedOccurrence[] {
  return occurrences
    .filter((o): o is DatedOccurrence => !!o.due_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

/**
 * Occurrences whose outcome is settled: completed, or overdue-and-incomplete
 * ("missed"). An Occurrence due today or later is still pending — like a
 * Habit's unlogged today, it isn't a miss until its day has actually passed.
 */
function decidedOccurrences(
  occurrences: TaskOccurrence[],
  today: Date,
): DatedOccurrence[] {
  const todayStart = startOfDay(today);
  return sortedByDueDate(occurrences).filter(
    (o) =>
      o.is_completed || isAfter(todayStart, startOfDay(parseISO(o.due_date))),
  );
}

/** Completed Occurrences / decided Occurrences. `null` when none are decided yet. */
export function getTaskCompletionRate(
  occurrences: TaskOccurrence[],
  today: Date = new Date(),
): number | null {
  const decided = decidedOccurrences(occurrences, today);
  if (decided.length === 0) return null;
  return decided.filter((o) => o.is_completed).length / decided.length;
}

/**
 * Completed Occurrences with `completed_at <= due_date` / completed
 * Occurrences with a due date. `null` when nothing has been completed yet.
 */
export function getTaskOnTimeRate(
  occurrences: TaskOccurrence[],
): number | null {
  const completed = occurrences.filter(
    (o) => o.is_completed && o.completed_at && o.due_date,
  );
  if (completed.length === 0) return null;
  const onTime = completed.filter(
    (o) => !isAfter(parseISO(o.completed_at!), parseISO(o.due_date!)),
  ).length;
  return onTime / completed.length;
}

/** Current unbroken run of completed Occurrences, walking back from the most recent decided one. */
export function getTaskCurrentStreak(
  occurrences: TaskOccurrence[],
  today: Date = new Date(),
): number {
  const decided = decidedOccurrences(occurrences, today);
  let streak = 0;
  for (let i = decided.length - 1; i >= 0; i--) {
    if (!decided[i].is_completed) break;
    streak++;
  }
  return streak;
}

/** Longest run of consecutive completed Occurrences over the decided set. */
export function getTaskBestStreak(
  occurrences: TaskOccurrence[],
  today: Date = new Date(),
): number {
  const decided = decidedOccurrences(occurrences, today);
  let best = 0;
  let run = 0;
  for (const o of decided) {
    run = o.is_completed ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function getTaskTotalCompletions(occurrences: TaskOccurrence[]): number {
  return occurrences.filter((o) => o.is_completed).length;
}
