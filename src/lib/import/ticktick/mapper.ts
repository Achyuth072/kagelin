import { extractChecklistItems } from "./parser";
import { parseTickTickRecurrence } from "./recurrence";
import type { RawTickTickRow, MappedTickTickTask } from "./types";

// TickTick encodes priorities as 0 (None), 1 (Low), 3 (Med), 5 (High), inverted from Kagelin's 1-4 scale.
export function mapPriority(priorityStr?: string | null): 1 | 2 | 3 | 4 {
  switch (priorityStr?.trim()) {
    case "5":
      return 1;
    case "3":
      return 2;
    case "1":
      return 3;
    case "0":
    default:
      return 4;
  }
}

export function parseTickTickDate(
  dateStr?: string | null,
  options?: { isAllDay?: boolean },
): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  if (options?.isAllDay) {
    // Anchor all-day dates to UTC midnight to prevent local browser timezone shifts
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
    if (match) {
      return `${match[1]}T00:00:00.000Z`;
    }
  }

  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

function convertChecklistToMarkdown(content: string): string {
  return content
    .replace(/^▫\s*\[ \]/gm, "- [ ]")
    .replace(/^▫\s*\[[xX]\]/gm, "- [x]")
    .replace(/^▫\s*/gm, "- [ ]");
}

export function mapTickTickTasks(rows: RawTickTickRow[]): MappedTickTickTask[] {
  const rowByTaskId = new Map<string, RawTickTickRow>();
  const tempIdByTaskId = new Map<string, string>();

  for (const row of rows) {
    rowByTaskId.set(row.taskId, row);
    tempIdByTaskId.set(row.taskId, crypto.randomUUID());
  }

  const mappedTasks: MappedTickTickTask[] = [];

  for (const row of rows) {
    const tempId = tempIdByTaskId.get(row.taskId)!;
    const isAllDay = row["Is All Day"] === "1";

    const doDate = parseTickTickDate(row["Start Date"], { isAllDay });
    const dueDate = parseTickTickDate(row["Due Date"], { isAllDay });

    const priority = mapPriority(row.Priority);

    const isStatusCompleted = row.Status === "1" || row.Status === "2";
    const completedAt = isStatusCompleted
      ? parseTickTickDate(row["Completed Time"])
      : null;

    const rawTitle = (row.Title || "").trim();
    const content = rawTitle || "Untitled Task";

    const repeatStr = (row.Repeat || "").trim();
    const recurrence = repeatStr ? parseTickTickRecurrence(repeatStr) : null;
    const recurrenceNote =
      repeatStr && !recurrence
        ? `> **Imported Recurrence:** \`${repeatStr}\``
        : null;

    const tagList = (row.Tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const tagsString =
      tagList.length > 0 ? tagList.map((t) => `#${t}`).join(" ") : null;

    const statusArchivedNote =
      row.Status === "2" ? "[Status: Archived in TickTick]" : null;

    const ancestors: RawTickTickRow[] = [];
    let current = row;
    const visited = new Set<string>();

    // Guard against circular parent references in malformed CSVs
    while (current.parentId && current.parentId.trim()) {
      if (visited.has(current.taskId)) break;
      visited.add(current.taskId);
      const parent = rowByTaskId.get(current.parentId.trim());
      if (!parent) break;
      ancestors.push(parent);
      current = parent;
    }

    const depth = ancestors.length;
    const rootAncestor =
      ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;

    const rawOrder = parseInt(row.Order, 10);
    const dayOrder = !isNaN(rawOrder) ? rawOrder : 0;

    const isChecklist = row["Is Check list"] === "1";

    if (depth === 0) {
      let taskDescription: string | null = null;
      let extractedSteps: { title: string; is_completed: boolean }[] = [];

      if (isChecklist) {
        const extracted = extractChecklistItems(row.Content);
        taskDescription = extracted.strippedDescription;
        extractedSteps = extracted.items;
      } else {
        taskDescription = row.Content?.trim() || null;
      }

      const descParts: string[] = [];
      if (statusArchivedNote) descParts.push(statusArchivedNote);
      if (taskDescription) descParts.push(taskDescription);
      if (tagsString) descParts.push(tagsString);
      if (recurrenceNote) descParts.push(recurrenceNote);

      const finalDescription =
        descParts.length > 0 ? descParts.join("\n\n") : null;

      mappedTasks.push({
        tempId,
        tempParentId: null,
        originalTaskId: row.taskId,
        originalParentId: null,
        content,
        description: finalDescription,
        priority,
        dueDate,
        doDate,
        is_completed: isStatusCompleted,
        completedAt,
        recurrence,
        listName: row["List Name"] || "",
        folderName: row["Folder Name"] || null,
        dayOrder,
        originalDepth: 0,
      });

      extractedSteps.forEach((step, stepIdx) => {
        mappedTasks.push({
          tempId: crypto.randomUUID(),
          tempParentId: tempId,
          originalTaskId: `${row.taskId}:step:${stepIdx}`,
          originalParentId: row.taskId,
          content: step.title,
          description: null,
          priority: 4,
          dueDate: null,
          doDate: null,
          is_completed: step.is_completed,
          completedAt: step.is_completed ? completedAt : null,
          recurrence: null,
          listName: row["List Name"] || "",
          folderName: row["Folder Name"] || null,
          dayOrder: dayOrder + stepIdx + 1,
          originalDepth: 1,
        });
      });
    } else {
      const rootTempId = rootAncestor
        ? (tempIdByTaskId.get(rootAncestor.taskId) ?? null)
        : null;

      let taskDescription: string | null = null;
      if (isChecklist) {
        // Retain child task checklists as markdown since Kagelin only supports one subtask level
        taskDescription =
          convertChecklistToMarkdown(row.Content).trim() || null;
      } else {
        taskDescription = row.Content?.trim() || null;
      }

      let breadcrumb: string | null = null;
      if (depth >= 2) {
        // Kagelin supports single-level subtasks; preserve deeper ancestry as breadcrumbs
        const path = ancestors
          .map((a) => (a.Title || "").trim() || "Untitled Task")
          .join(" > ");
        breadcrumb = `[TickTick Context: ${path}]`;
      }

      const descParts: string[] = [];
      if (breadcrumb) descParts.push(breadcrumb);
      if (statusArchivedNote) descParts.push(statusArchivedNote);
      if (taskDescription) descParts.push(taskDescription);
      if (tagsString) descParts.push(tagsString);
      if (recurrenceNote) descParts.push(recurrenceNote);

      const finalDescription =
        descParts.length > 0 ? descParts.join("\n\n") : null;

      mappedTasks.push({
        tempId,
        tempParentId: rootTempId,
        originalTaskId: row.taskId,
        originalParentId: row.parentId || null,
        content,
        description: finalDescription,
        priority,
        dueDate,
        doDate,
        is_completed: isStatusCompleted,
        completedAt,
        recurrence,
        listName: row["List Name"] || "",
        folderName: row["Folder Name"] || null,
        dayOrder,
        originalDepth: depth,
      });
    }
  }

  return mappedTasks;
}
