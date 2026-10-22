import * as Sentry from "@sentry/nextjs";
import { parseTodoistCsv } from "./parser";
import { mapTodoistRowsToKagelin, type MappedTodoistTask } from "./mapper";
import type { ParseTodoistResult, TodoistRow } from "./types";
import { summarizeTasks, type TodoistArchiveImportPreview } from "./plan";
import { taskMutations } from "@/lib/mutations/task";
import { projectMutations } from "@/lib/mutations/project";
import { persistImportSource } from "@/lib/mutations/importSource";
import type { Task } from "@/lib/types/task";

const GUEST_MODE_KEY = "kanso_guest_mode";

function detectGuestMode(): boolean {
  return (
    typeof window !== "undefined" &&
    localStorage.getItem(GUEST_MODE_KEY) === "true"
  );
}

// Raised when an import stops part-way, with what was already committed.
export class TodoistImportFailure extends Error {
  readonly importedCount: number;
  readonly createdProjectCount: number;

  constructor(
    message: string,
    importedCount: number,
    createdProjectCount: number,
  ) {
    super(message);
    this.name = "TodoistImportFailure";
    this.importedCount = importedCount;
    this.createdProjectCount = createdProjectCount;
  }
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

function toCreateInput(
  task: MappedTodoistTask,
  projectId: string | undefined,
  parentId: string | undefined,
  clientId: string,
) {
  return {
    content: task.content,
    description: task.description ?? undefined,
    priority: task.priority,
    due_date: task.dueDate ?? undefined,
    do_date: task.doDate ?? undefined,
    recurrence: task.recurrence,
    project_id: projectId,
    parent_id: parentId,
    _clientId: clientId,
  };
}

// Roots first, then their subtasks; every id is kept so a failure can undo it.
async function createMappedTasks(
  tasks: MappedTodoistTask[],
  projectId: string | undefined,
  createdTaskIds: string[],
): Promise<Task[]> {
  const roots = tasks.filter((task) => !task.tempParentId);
  const subtasks = tasks.filter((task) => task.tempParentId);

  // Client-generated ids keep the mapping to the source rows.
  const rootClientIds = roots.map(() => crypto.randomUUID());
  const createdRoots = await taskMutations.createMany(
    roots.map((task, index) =>
      toCreateInput(task, projectId, undefined, rootClientIds[index]),
    ),
  );
  createdRoots.forEach((task) => createdTaskIds.push(task.id));

  const rootIdByTempId = new Map<string, string>();
  roots.forEach((task, index) => {
    rootIdByTempId.set(task.tempId, rootClientIds[index]);
  });

  if (subtasks.length === 0) return createdRoots;

  const createdSubtasks = await taskMutations.createMany(
    subtasks.map((task) =>
      toCreateInput(
        task,
        projectId,
        rootIdByTempId.get(task.tempParentId ?? ""),
        crypto.randomUUID(),
      ),
    ),
  );
  createdSubtasks.forEach((task) => createdTaskIds.push(task.id));

  return [...createdRoots, ...createdSubtasks];
}

// Undoes what this import wrote, so a failure leaves the workspace as it was.
async function rollbackImport(
  taskIds: string[],
  projectIds: string[],
): Promise<boolean> {
  try {
    // Tasks first: deleting a project nulls out its tasks' project_id.
    await taskMutations.deleteMany(taskIds);
    await projectMutations.deleteMany(projectIds);
    return true;
  } catch (rollbackError) {
    Sentry.captureException(rollbackError);
    return false;
  }
}

// ADR 0006 captures before the import, and a capture failure never blocks it.
function captureRawSource(
  rawSource: unknown,
  fileName: string | null,
  isGuest: boolean,
): void {
  void persistImportSource(
    { source_app: "todoist", file_name: fileName, raw: rawSource },
    { isGuest },
  ).catch((error) => Sentry.captureException(error));
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

  captureRawSource(preview.rawSource, options.fileName ?? null, isGuest);

  const createdTaskIds: string[] = [];
  try {
    const created = await createMappedTasks(
      preview.tasks,
      options.projectId || undefined,
      createdTaskIds,
    );
    return { importedCount: created.length };
  } catch (error) {
    const rolledBack = await rollbackImport(createdTaskIds, []);
    const detail = error instanceof Error ? error.message : String(error);
    throw new TodoistImportFailure(
      rolledBack
        ? `Import failed and was rolled back: ${detail}`
        : `Import stopped after ${createdTaskIds.length} task(s) were created: ${detail}`,
      createdTaskIds.length,
      0,
    );
  }
}

export interface ExecuteTodoistArchiveOptions {
  isGuest: boolean;
  fileName?: string;
}

export async function executeTodoistArchiveImport(
  preview: TodoistArchiveImportPreview,
  options: ExecuteTodoistArchiveOptions,
): Promise<{ importedCount: number; createdProjectCount: number }> {
  captureRawSource(
    preview.rawSource,
    options.fileName ?? null,
    options.isGuest,
  );

  const createdTaskIds: string[] = [];
  const createdProjectIds: string[] = [];
  let importedCount = 0;
  let createdProjectCount = 0;

  try {
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
        createdProjectIds.push(created.id);
        createdProjectCount++;
      }

      const created = await createMappedTasks(
        project.tasks,
        projectId,
        createdTaskIds,
      );
      importedCount += created.length;
    }
  } catch (error) {
    const rolledBack = await rollbackImport(createdTaskIds, createdProjectIds);
    const detail = error instanceof Error ? error.message : String(error);
    throw new TodoistImportFailure(
      rolledBack
        ? `Import failed and was rolled back: ${detail}`
        : `Import stopped after ${createdTaskIds.length} task(s) were created: ${detail}`,
      createdTaskIds.length,
      createdProjectCount,
    );
  }

  return { importedCount, createdProjectCount };
}
