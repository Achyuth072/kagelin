import { parseTodoistCsv } from "./parser";
import { mapTodoistRowsToKagelin, type MappedTodoistTask } from "./mapper";
import type { TodoistRow, ParseTodoistResult } from "./types";
import { taskMutations } from "@/lib/mutations/task";
import { persistImportSource } from "@/lib/mutations/importSource";

export interface TodoistImportPreview {
  tasks: MappedTodoistTask[];
  totalTasks: number;
  rootTasksCount: number;
  subtasksCount: number;
  recurringCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  rawSource: {
    meta: ParseTodoistResult["meta"];
    rows: TodoistRow[];
  };
}

export function prepareTodoistImport(
  csvContent: string,
  options?: { refDate?: Date },
): TodoistImportPreview {
  const parsed = parseTodoistCsv(csvContent);
  const mapped = mapTodoistRowsToKagelin(parsed.rows, options?.refDate);

  let rootTasksCount = 0;
  let subtasksCount = 0;
  let recurringCount = 0;

  const dates: string[] = [];

  for (const task of mapped.tasks) {
    if (task.tempParentId) {
      subtasksCount++;
    } else {
      rootTasksCount++;
    }

    if (task.recurrence) {
      recurringCount++;
    }

    if (task.dueDate) dates.push(task.dueDate);
    if (task.doDate) dates.push(task.doDate);
  }

  dates.sort();
  const earliestDate = dates.length > 0 ? dates[0] : null;
  const latestDate = dates.length > 0 ? dates[dates.length - 1] : null;

  return {
    tasks: mapped.tasks,
    totalTasks: mapped.tasks.length,
    rootTasksCount,
    subtasksCount,
    recurringCount,
    earliestDate,
    latestDate,
    rawSource: {
      meta: parsed.meta,
      rows: parsed.rows,
    },
  };
}

export interface ExecuteTodoistImportOptions {
  projectId?: string | null;
  fileName?: string;
}

export async function executeTodoistImport(
  preview: TodoistImportPreview,
  options: ExecuteTodoistImportOptions = {},
): Promise<{ importedCount: number }> {
  const isGuest =
    typeof window !== "undefined" &&
    localStorage.getItem("kanso_guest_mode") === "true";

  // Persist raw source for ADR 0006 round-trip provenance
  await persistImportSource(
    {
      source_app: "todoist",
      file_name: options.fileName ?? null,
      raw: preview.rawSource,
    },
    { isGuest },
  );

  const topLevelTasks = preview.tasks.filter((t) => !t.tempParentId);
  const subtasks = preview.tasks.filter((t) => Boolean(t.tempParentId));

  const idMap = new Map<string, string>();
  let importedCount = 0;

  const createTask = (task: MappedTodoistTask, parentId?: string) =>
    taskMutations.create({
      content: task.content,
      description: task.description ?? undefined,
      priority: task.priority,
      due_date: task.dueDate ?? undefined,
      do_date: task.doDate ?? undefined,
      recurrence: task.recurrence,
      project_id: options.projectId ? options.projectId : undefined,
      parent_id: parentId,
    });

  // 1. Create top-level tasks
  for (const task of topLevelTasks) {
    const created = await createTask(task);
    idMap.set(task.tempId, created.id);
    importedCount++;
  }

  // 2. Create subtasks with resolved parent_ids
  for (const task of subtasks) {
    const parentId = task.tempParentId
      ? idMap.get(task.tempParentId)
      : undefined;
    await createTask(task, parentId);
    importedCount++;
  }

  return { importedCount };
}
