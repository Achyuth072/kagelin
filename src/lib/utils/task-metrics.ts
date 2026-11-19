import { isAfter, isBefore, isSameDay, parseISO, startOfDay } from "date-fns";
import type { Task } from "@/lib/types/task";

export type TaskOccurrence = Pick<
  Task,
  "due_date" | "completed_at" | "is_completed"
>;

export type TaskScheduleCategory =
  | "overdue"
  | "due_today"
  | "reschedule_needed"
  | "planned_today"
  | "unscheduled"
  | "scheduled";

export type TaskScheduleInput = {
  due_date?: string | null;
  do_date?: string | null;
  is_completed?: boolean;
};

/**
 * Accurately counts completed occurrences in a series regardless of schedule.
 */
export function getTaskTotalCompletions(occurrences: TaskOccurrence[]): number {
  return occurrences.filter((o) => o.is_completed).length;
}

/**
 * Calculates the proportion of completed occurrences delivered on or before
 * due_date, returning null if no completed occurrences with a due date exist.
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

/**
 * Classifies a task's schedule state into distinct operational or commitment categories.
 * Separates expired operational day planning (reschedule_needed) from expired
 * contractual deadlines (overdue). When both dates exist, due_date governs overdue
 * state while do_date governs day-placement in daily views.
 */
export function categorizeTaskSchedule(
  task: TaskScheduleInput,
  today: Date = new Date(),
): TaskScheduleCategory {
  const hasDueDate = Boolean(task.due_date);
  const hasDoDate = Boolean(task.do_date);

  if (!hasDueDate && !hasDoDate) {
    return "unscheduled";
  }

  const todayStart = startOfDay(today);
  const isCompleted = Boolean(task.is_completed);

  // 1. Expired due_date on an uncompleted task is an overdue commitment.
  // When both dates exist, due_date governs the overdue commitment state.
  if (hasDueDate && !isCompleted) {
    const dueParsed = parseISO(task.due_date!);
    if (
      !isNaN(dueParsed.getTime()) &&
      isBefore(startOfDay(dueParsed), todayStart)
    ) {
      return "overdue";
    }
  }

  // 2. do_date today indicates planned for today.
  // Governs day-placement in daily views.
  if (hasDoDate) {
    const doParsed = parseISO(task.do_date!);
    if (!isNaN(doParsed.getTime()) && isSameDay(doParsed, today)) {
      return "planned_today";
    }
  }

  // 3. due_date today indicates deadline is today.
  if (hasDueDate) {
    const dueParsed = parseISO(task.due_date!);
    if (!isNaN(dueParsed.getTime()) && isSameDay(dueParsed, today)) {
      return "due_today";
    }
  }

  // 4. Expired do_date on an uncompleted task indicates operational replanning / reschedule needed.
  if (hasDoDate && !isCompleted) {
    const doParsed = parseISO(task.do_date!);
    if (
      !isNaN(doParsed.getTime()) &&
      isBefore(startOfDay(doParsed), todayStart)
    ) {
      return "reschedule_needed";
    }
  }

  // Future scheduled dates or completed tasks with non-expired dates
  return "scheduled";
}
