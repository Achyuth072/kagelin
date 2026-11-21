import { stripHtmlTags } from "@/lib/utils/sanitize";
import {
  type MicrosoftTaskResource,
  type MicrosoftTasksDataset,
  type MappedMicrosoftTask,
} from "./types";

export interface MapMicrosoftTasksResult {
  tasks: MappedMicrosoftTask[];
  tasksByListId: Record<string, MappedMicrosoftTask[]>;
}

/**
 * Normalizes an arbitrary ISO-like timestamp string into standard RFC 3339 ISO string.
 * Accounts for Microsoft Graph's UTC datetimes lacking timezone indicators.
 */
function parseIsoTimestamp(rawTimestamp?: string | null): string | null {
  if (!rawTimestamp) return null;
  const trimmed = rawTimestamp.trim();
  if (!trimmed) return null;

  try {
    // If string has timezone offset or 'Z', parse directly
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
      const parsed = new Date(trimmed);
      return !isNaN(parsed.getTime()) ? parsed.toISOString() : null;
    }
    // Microsoft Graph timestamps are UTC: append 'Z' if missing timezone
    const parsed = new Date(`${trimmed}Z`);
    return !isNaN(parsed.getTime()) ? parsed.toISOString() : null;
  } catch {
    return null;
  }
}

/**
 * Microsoft Tasks Timezone Safe Due Date Parser
 *
 * Extracts the calendar date part (YYYY-MM-DD) and anchors it directly to
 * UTC midnight without passing through local machine Date offsets to prevent
 * retrospective 1-day drift in Western timezones (UTC-1 through UTC-12).
 */
export function parseMicrosoftTaskDueDate(
  dueInput?: string | { dateTime?: string; timeZone?: string } | null,
): string | undefined {
  if (!dueInput) return undefined;

  const rawStr = typeof dueInput === "string" ? dueInput : dueInput.dateTime;
  if (!rawStr) return undefined;

  const datePartMatch = /^(\d{4}-\d{2}-\d{2})/.exec(rawStr.trim());
  if (!datePartMatch) return undefined;

  const datePart = datePartMatch[1];
  return `${datePart}T00:00:00.000Z`;
}

/**
 * Maps a single Microsoft Task list's raw tasks and checklist items into Kagelin's flat/single-level subtask model.
 *
 * - Root tasks map `title` -> `content`.
 * - High importance maps to 1 (P1); normal / low map to 4 (P4).
 * - Sanitizes HTML descriptions via `stripHtmlTags()`.
 * - Converts `checklistItems` into depth-1 child tasks (Steps) with `parent_id = task.id`.
 * - Assigns contiguous 0-indexed integer `dayOrder` preserving pre-order hierarchy.
 */
export function mapMicrosoftTaskList(
  tasks: MicrosoftTaskResource[],
  listId: string,
  options?: { isFlaggedEmails?: boolean },
): MappedMicrosoftTask[] {
  const mappedTasks: MappedMicrosoftTask[] = [];
  let currentDayOrder = 0;
  const isFlaggedEmails = options?.isFlaggedEmails ?? false;

  for (const task of tasks) {
    const rawContent = (task.title || "").trim();
    const content = rawContent || "Untitled Task";

    let description: string | null = null;
    if (!isFlaggedEmails && task.body?.content) {
      const sanitized =
        task.body.contentType === "html"
          ? stripHtmlTags(task.body.content)
          : task.body.content.trim();
      description = sanitized || null;
    }

    const dueDate = parseMicrosoftTaskDueDate(task.dueDateTime) ?? null;
    const isCompleted = task.status === "completed";

    let completedAt: string | null = null;
    if (isCompleted) {
      const completedRaw =
        typeof task.completedDateTime === "string"
          ? task.completedDateTime
          : task.completedDateTime?.dateTime;

      completedAt =
        parseIsoTimestamp(completedRaw) ??
        parseIsoTimestamp(task.lastModifiedDateTime);
    }

    const priority = task.importance === "high" ? 1 : 4;

    const rootMapped: MappedMicrosoftTask = {
      id: task.id,
      tempId: task.id,
      parentId: null,
      tempParentId: null,
      content,
      description,
      dueDate,
      isCompleted,
      completedAt,
      priority,
      dayOrder: currentDayOrder++,
      listId,
    };

    mappedTasks.push(rootMapped);

    // Convert checklistItems into child Steps
    const checklistItems = Array.isArray(task.checklistItems)
      ? task.checklistItems
      : [];

    for (const item of checklistItems) {
      const itemTitle = (item.displayName || "").trim();
      const stepContent = itemTitle || "Untitled Step";
      const isStepCompleted = Boolean(item.isChecked);
      const stepCompletedAt = isStepCompleted
        ? parseIsoTimestamp(item.checkedDateTime)
        : null;

      const stepMapped: MappedMicrosoftTask = {
        id: item.id,
        tempId: item.id,
        parentId: task.id,
        tempParentId: task.id,
        content: stepContent,
        description: null,
        dueDate: null,
        isCompleted: isStepCompleted,
        completedAt: stepCompletedAt,
        priority: 4,
        dayOrder: currentDayOrder++,
        listId,
      };

      mappedTasks.push(stepMapped);
    }
  }

  return mappedTasks;
}

/**
 * Maps a full MicrosoftTasksDataset into Kagelin mapped tasks.
 */
export function mapMicrosoftTasksToKagelin(
  dataset: MicrosoftTasksDataset,
): MapMicrosoftTasksResult {
  const allTasks: MappedMicrosoftTask[] = [];
  const tasksByListId: Record<string, MappedMicrosoftTask[]> = {};

  for (const list of dataset.lists) {
    const rawListTasks = dataset.tasksByListId[list.id] ?? list.tasks ?? [];
    const mapped = mapMicrosoftTaskList(rawListTasks, list.id);
    tasksByListId[list.id] = mapped;
    allTasks.push(...mapped);
  }

  return {
    tasks: allTasks,
    tasksByListId,
  };
}
