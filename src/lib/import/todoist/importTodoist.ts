import { parseTodoistCsv } from "./parser";
import { mapTodoistRowsToKagelin, type MappedTodoistTask } from "./mapper";
import type { TodoistRow, ParseTodoistResult } from "./types";
import { summarizeTasks, type TodoistArchiveImportPreview } from "./plan";
import { taskMutations } from "@/lib/mutations/task";
import { projectMutations } from "@/lib/mutations/project";
import { persistImportSource } from "@/lib/mutations/importSource";

const GUEST_MODE_KEY = "kanso_guest_mode";

function detectGuestMode(): boolean {
  return (
    typeof window !== "undefined" &&
    localStorage.getItem(GUEST_MODE_KEY) === "true"
  );
}

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

  return {
    tasks: mapped.tasks,
    totalTasks: mapped.tasks.length,
    ...summarizeTasks(mapped.tasks),
    rawSource: {
      meta: parsed.meta,
      rows: parsed.rows,
    },
  };
}

async function createMappedTasks(
  tasks: MappedTodoistTask[],
  projectId: string | undefined,
): Promise<number> {
  const createTask = (task: MappedTodoistTask, parentId?: string) =>
    taskMutations.create({
      content: task.content,
      description: task.description ?? undefined,
      priority: task.priority,
      due_date: task.dueDate ?? undefined,
      do_date: task.doDate ?? undefined,
      recurrence: task.recurrence,
      project_id: projectId,
      parent_id: parentId,
    });

  const idMap = new Map<string, string>();
  let importedCount = 0;

  for (const task of tasks) {
    if (!task.tempParentId) {
      const created = await createTask(task);
      idMap.set(task.tempId, created.id);
      importedCount++;
    }
  }

  for (const task of tasks) {
    if (task.tempParentId) {
      const parentId = idMap.get(task.tempParentId);
      await createTask(task, parentId);
      importedCount++;
    }
  }

  return importedCount;
}

export interface ExecuteTodoistImportOptions {
  projectId?: string | null;
  fileName?: string;
  isGuest?: boolean;
}

export async function executeTodoistImport(
  preview: TodoistImportPreview,
  options: ExecuteTodoistImportOptions = {},
): Promise<{ importedCount: number }> {
  const isGuest = options.isGuest ?? detectGuestMode();

  await persistImportSource(
    {
      source_app: "todoist",
      file_name: options.fileName ?? null,
      raw: preview.rawSource,
    },
    { isGuest },
  );

  const importedCount = await createMappedTasks(
    preview.tasks,
    options.projectId || undefined,
  );

  return { importedCount };
}

export interface ExecuteTodoistArchiveOptions {
  isGuest: boolean;
  fileName?: string;
}

export async function executeTodoistArchiveImport(
  preview: TodoistArchiveImportPreview,
  options: ExecuteTodoistArchiveOptions,
): Promise<{ importedCount: number; createdProjectCount: number }> {
  await persistImportSource(
    {
      source_app: "todoist",
      file_name: options.fileName ?? null,
      raw: preview.rawSource,
    },
    { isGuest: options.isGuest },
  );

  let importedCount = 0;
  let createdProjectCount = 0;

  for (const project of preview.projects) {
    if (project.tasks.length === 0) continue;

    let projectId: string | undefined;
    if (project.isInbox) {
      projectId = undefined;
    } else if (project.status === "merged" && project.existingProjectId) {
      projectId = project.existingProjectId;
    } else {
      const created = await projectMutations.create({
        name: project.name,
        color: project.color,
        viewStyle: project.viewStyle,
      });
      projectId = created.id;
      createdProjectCount++;
    }

    importedCount += await createMappedTasks(project.tasks, projectId);
  }

  return { importedCount, createdProjectCount };
}
