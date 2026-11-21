import { recordDiagnosticError } from "@/lib/errors/diagnostics";
import { taskMutations } from "@/lib/mutations/task";
import { projectMutations } from "@/lib/mutations/project";
import type {
  MicrosoftTasksImportPreview,
  ParentRedirect,
  ExecuteMicrosoftTasksImportOptions,
} from "./types";

/**
 * Split an array of items into batches of at most `chunkSize`.
 */
export function chunkArray<T>(items: T[], chunkSize = 100): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Raised when a Microsoft Tasks import fails or is aborted.
 */
export class MicrosoftTasksImportFailure extends Error {
  readonly importedCount: number;
  readonly createdProjectCount: number;

  constructor(
    message: string,
    importedCount: number,
    createdProjectCount: number,
  ) {
    super(message);
    this.name = "MicrosoftTasksImportFailure";
    this.importedCount = importedCount;
    this.createdProjectCount = createdProjectCount;
  }
}

/**
 * Resolves a subtask/step's parent ID through newly created roots and parentRedirects.
 */
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

/**
 * Roll back created tasks in chunks of <= 100 and created projects in reverse order,
 * leaving pre-existing user data and merged projects untouched.
 */
export async function rollbackMicrosoftTasksImport(
  createdTaskIds: string[],
  createdProjectIds: string[],
): Promise<boolean> {
  let success = true;

  // 1. Delete created tasks in batches of <= 100 (in reverse order)
  const reversedTaskIds = [...createdTaskIds].reverse();
  for (const chunk of chunkArray(reversedTaskIds, 100)) {
    try {
      await taskMutations.deleteMany(chunk);
    } catch (err) {
      success = false;
      void recordDiagnosticError(err);
    }
  }

  // 2. Delete created projects (in reverse order)
  const reversedProjectIds = [...createdProjectIds].reverse();
  for (const projectId of reversedProjectIds) {
    try {
      await projectMutations.delete(projectId);
    } catch (err) {
      success = false;
      void recordDiagnosticError(err);
    }
  }

  return success;
}

/**
 * Executes atomic chunked database mutations for a planned Microsoft Tasks import.
 *
 * - Creates projects sequentially and accumulates created project IDs (excluding merged projects).
 * - Inserts root tasks first in chunks of <= 100 items via taskMutations.createMany().
 * - Inserts checklist child steps in chunks of <= 100 with parents resolved to new client IDs or existing tasks.
 * - On failure or user abort, triggers rollbackMicrosoftTasksImport.
 */
export async function executeMicrosoftTasksImport(
  preview: MicrosoftTasksImportPreview,
  options: ExecuteMicrosoftTasksImportOptions = {},
): Promise<{ importedCount: number; createdProjectCount: number }> {
  const includeCompleted = options.includeCompleted ?? true;
  const createdTaskIds: string[] = [];
  const createdProjectIds: string[] = [];

  const checkAborted = () => {
    if (options.signal?.aborted) {
      throw new Error("Import aborted by user");
    }
  };

  try {
    checkAborted();

    for (const project of preview.projects) {
      const eligibleTasks = includeCompleted
        ? project.tasks
        : project.tasks.filter((task) => !task.isCompleted);

      if (eligibleTasks.length === 0) continue;

      checkAborted();

      let projectId: string | undefined;
      if (project.isInbox) {
        projectId = undefined;
      } else if (project.existingProjectId) {
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
      const steps = eligibleTasks.filter((task) => Boolean(task.tempParentId));

      // 1. Create root tasks first (in chunks of <= 100)
      const rootClientIds = roots.map(() => crypto.randomUUID());
      const rootInputs = roots.map((task, index) => ({
        content: task.content,
        description: task.description ?? undefined,
        due_date: task.dueDate ?? undefined,
        project_id: projectId,
        priority: task.priority,
        is_completed: task.isCompleted,
        completed_at: task.completedAt ?? undefined,
        day_order: task.dayOrder,
        _clientId: rootClientIds[index],
      }));

      for (const chunk of chunkArray(rootInputs, 100)) {
        checkAborted();
        const createdRoots = await taskMutations.createMany(chunk);
        createdRoots.forEach((task) => createdTaskIds.push(task.id));
      }

      const rootIdByTempId = new Map<string, string>();
      roots.forEach((task, index) => {
        rootIdByTempId.set(task.tempId, rootClientIds[index]);
      });

      // 2. Create child checklist Steps (in chunks of <= 100)
      if (steps.length > 0) {
        const stepInputs = steps
          .map((task) => {
            const resolvedParent = resolveParentId(
              task.tempParentId,
              rootIdByTempId,
              project.parentRedirects,
            );
            if (!resolvedParent) return null;

            return {
              content: task.content,
              description: task.description ?? undefined,
              due_date: task.dueDate ?? undefined,
              project_id: projectId,
              parent_id: resolvedParent,
              priority: task.priority,
              is_completed: task.isCompleted,
              completed_at: task.completedAt ?? undefined,
              day_order: task.dayOrder,
              _clientId: crypto.randomUUID(),
            };
          })
          .filter(
            (input): input is NonNullable<typeof input> => input !== null,
          );

        for (const chunk of chunkArray(stepInputs, 100)) {
          checkAborted();
          const createdSteps = await taskMutations.createMany(chunk);
          createdSteps.forEach((task) => createdTaskIds.push(task.id));
        }
      }
    }

    return {
      importedCount: createdTaskIds.length,
      createdProjectCount: createdProjectIds.length,
    };
  } catch (error) {
    const rolledBack = await rollbackMicrosoftTasksImport(
      createdTaskIds,
      createdProjectIds,
    );
    const detail = error instanceof Error ? error.message : String(error);
    throw new MicrosoftTasksImportFailure(
      rolledBack
        ? `Import failed and was rolled back: ${detail}`
        : `Import stopped after ${createdTaskIds.length} task(s) were created: ${detail}`,
      createdTaskIds.length,
      createdProjectIds.length,
    );
  }
}
