import { recordDiagnosticError } from "@/lib/errors/diagnostics";
import { taskMutations } from "@/lib/mutations/task";
import { projectMutations } from "@/lib/mutations/project";
import { persistImportSource } from "@/lib/mutations/importSource";
import type {
  TickTickImportPreview,
  ParentRedirect,
  ExecuteTickTickImportOptions,
} from "./types";

export function chunkArray<T>(items: T[], chunkSize = 100): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export class TickTickImportFailure extends Error {
  readonly importedCount: number;
  readonly createdProjectCount: number;

  constructor(
    message: string,
    importedCount: number,
    createdProjectCount: number,
  ) {
    super(message);
    this.name = "TickTickImportFailure";
    this.importedCount = importedCount;
    this.createdProjectCount = createdProjectCount;
  }
}

function resolveParentId(
  tempParentId: string | null,
  rootIdByTempId: Map<string, string>,
  parentRedirects: Record<string, ParentRedirect>,
): string | undefined {
  let current = tempParentId;
  const visited = new Set<string>();

  while (current && !visited.has(current)) {
    visited.add(current);

    const direct = rootIdByTempId.get(current);
    if (direct) return direct;

    const redirect = parentRedirects[current];
    if (!redirect) return undefined;
    if (redirect.kind === "existing") return redirect.taskId;
    current = redirect.tempId;
  }

  return undefined;
}

// Rolls back created tasks and projects in reverse order, leaving existing user data untouched.
export async function rollbackTickTickImport(
  createdTaskIds: string[],
  createdProjectIds: string[],
): Promise<boolean> {
  let success = true;

  const reversedTaskIds = [...createdTaskIds].reverse();
  for (const chunk of chunkArray(reversedTaskIds, 100)) {
    try {
      await taskMutations.deleteMany(chunk);
    } catch (err) {
      success = false;
      void recordDiagnosticError(err);
    }
  }

  const reversedProjectIds = [...createdProjectIds].reverse();
  if (reversedProjectIds.length > 0) {
    try {
      await projectMutations.deleteMany(reversedProjectIds);
    } catch (err) {
      success = false;
      void recordDiagnosticError(err);
    }
  }

  return success;
}

export async function executeTickTickImport(
  preview: TickTickImportPreview,
  options: ExecuteTickTickImportOptions = {},
): Promise<{ importedCount: number; createdProjectCount: number }> {
  const includeCompleted = options.includeCompleted ?? true;
  const createdTaskIds: string[] = [];
  const createdProjectIds: string[] = [];

  const isGuest =
    options.isGuest ??
    (typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true");

  try {
    if (options.signal?.aborted) {
      throw new Error("Import aborted by user");
    }

    if (preview.rawSource) {
      try {
        // ADR 0006 captures before the import, and a capture failure never blocks it
        await persistImportSource(
          {
            source_app: "ticktick",
            file_name: options.fileName ?? null,
            raw: preview.rawSource,
          },
          { isGuest },
        );
      } catch (err) {
        void recordDiagnosticError(err);
      }
    }

    for (const project of preview.projects) {
      const eligibleTasks = includeCompleted
        ? project.tasks
        : project.tasks.filter((task) => !task.is_completed);

      if (eligibleTasks.length === 0) continue;

      if (options.signal?.aborted) {
        throw new Error("Import aborted by user");
      }

      let projectId: string | undefined;
      if (project.isInbox) {
        projectId = undefined;
      } else if (project.status === "merged" && project.existingProjectId) {
        projectId = project.existingProjectId;
      } else {
        const createdProject = await projectMutations.create({
          name: project.name,
          color: project.color,
        });
        projectId = createdProject.id;
        createdProjectIds.push(createdProject.id);
      }

      const roots = eligibleTasks.filter((task) => !task.tempParentId);
      const subtasks = eligibleTasks.filter((task) =>
        Boolean(task.tempParentId),
      );

      const rootClientIds = roots.map(() => crypto.randomUUID());
      const rootInputs = roots.map((task, index) => ({
        content: task.content,
        description: task.description ?? undefined,
        priority: task.priority,
        due_date: task.dueDate ?? undefined,
        do_date: task.doDate ?? undefined,
        recurrence: task.recurrence ?? undefined,
        project_id: projectId,
        is_completed: task.is_completed,
        completed_at: task.completedAt ?? undefined,
        day_order: task.dayOrder,
        created_at: task.createdAt ?? undefined,
        _clientId: rootClientIds[index],
      }));

      for (const chunk of chunkArray(rootInputs, 100)) {
        if (options.signal?.aborted) {
          throw new Error("Import aborted by user");
        }
        const createdRoots = await taskMutations.createMany(chunk);
        createdRoots.forEach((task) => createdTaskIds.push(task.id));
      }

      const rootIdByTempId = new Map<string, string>();
      roots.forEach((task, index) => {
        rootIdByTempId.set(task.tempId, rootClientIds[index]);
      });

      if (subtasks.length > 0) {
        const mergedRedirects = {
          ...preview.parentRedirects,
          ...project.parentRedirects,
        };

        const subtaskInputs = subtasks.map((task) => {
          const resolvedParent = resolveParentId(
            task.tempParentId,
            rootIdByTempId,
            mergedRedirects,
          );

          return {
            content: task.content,
            description: task.description ?? undefined,
            priority: task.priority,
            due_date: task.dueDate ?? undefined,
            do_date: task.doDate ?? undefined,
            recurrence: task.recurrence ?? undefined,
            project_id: projectId,
            parent_id: resolvedParent,
            is_completed: task.is_completed,
            completed_at: task.completedAt ?? undefined,
            day_order: task.dayOrder,
            created_at: task.createdAt ?? undefined,
            _clientId: crypto.randomUUID(),
          };
        });

        for (const chunk of chunkArray(subtaskInputs, 100)) {
          if (options.signal?.aborted) {
            throw new Error("Import aborted by user");
          }
          const createdSubtasks = await taskMutations.createMany(chunk);
          createdSubtasks.forEach((task) => createdTaskIds.push(task.id));
        }
      }
    }

    return {
      importedCount: createdTaskIds.length,
      createdProjectCount: createdProjectIds.length,
    };
  } catch (error) {
    const rolledBack = await rollbackTickTickImport(
      createdTaskIds,
      createdProjectIds,
    );
    const detail = error instanceof Error ? error.message : String(error);
    throw new TickTickImportFailure(
      rolledBack
        ? `Import failed and was rolled back: ${detail}`
        : `Import stopped after ${createdTaskIds.length} task(s) were created: ${detail}`,
      createdTaskIds.length,
      createdProjectIds.length,
    );
  }
}
