import {
  parseISO,
  isToday,
  isTomorrow,
  format,
  isBefore,
  startOfDay,
} from "date-fns";
import type { Task } from "@/lib/types/task";
import type { CreateTaskInput } from "@/lib/schemas/task";

export const priorityTextClasses: Record<1 | 2 | 3 | 4, string> = {
  1: "text-foreground font-bold",
  2: "text-foreground font-semibold",
  3: "text-foreground/90 font-medium",
  4: "text-muted-foreground",
};

// All priorities share the same high-contrast tokens, kept explicit per key
// for predictability.
export const priorityCheckboxClasses: Record<1 | 2 | 3 | 4, string> = {
  1: "border-foreground/80 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground",
  2: "border-foreground/80 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground",
  3: "border-foreground/80 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground",
  4: "border-foreground/80 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground",
};

export function formatDueDate(dateString: string): string {
  const date = parseISO(dateString);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
}

export function isOverdue(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const date = parseISO(dateString);
  return isBefore(date, startOfDay(new Date())) && !isToday(date);
}

/**
 * Stable DOM id for a task card, used as the `aria-activedescendant` target
 * on the scroll container that owns keyboard (Vim) navigation.
 */
export function taskDomId(taskId: string): string {
  return `task-item-${taskId}`;
}

export type TaskFormValues = CreateTaskInput;

export function taskToFormValues(task: Task): TaskFormValues {
  return {
    content: task.content ?? "",
    description: task.description || "",
    due_date: task.due_date ?? undefined,
    do_date: task.do_date ?? undefined,
    is_evening: task.is_evening || false,
    priority: task.priority,
    project_id: task.project_id ?? undefined,
    recurrence: task.recurrence ?? null,
  };
}

export function defaultTaskFormValues(initial?: {
  content?: string;
  dueDate?: Date | null;
}): TaskFormValues {
  return {
    content: initial?.content || "",
    description: "",
    due_date: initial?.dueDate?.toISOString() ?? undefined,
    do_date: undefined,
    is_evening: false,
    priority: 4,
    project_id: undefined,
    recurrence: null,
  };
}
