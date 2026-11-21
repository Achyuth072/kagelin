import { PROJECT_COLORS } from "@/lib/constants/colors";
import { mapMicrosoftTaskList } from "./mapper";
import {
  MICROSOFT_TASKS_PREVIEW_KIND,
  type MicrosoftTasksDataset,
  type MicrosoftTasksImportPreview,
  type MicrosoftTasksProjectPlan,
  type ExistingWorkspace,
  type ParentRedirect,
} from "./types";

const INBOX_KEY = "inbox";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/**
 * Indexes existing workspace root tasks by `(project_id, normalized_title, is_completed)`
 * and child steps by `(parent_id, normalized_title)`.
 */
function indexWorkspace(workspace: ExistingWorkspace) {
  const inboxProjectId = workspace.projects.find((p) => p.is_inbox)?.id ?? null;

  const rootIndex = new Map<string, string>(); // `${projectKey}::${normTitle}::${isCompleted}` -> taskId
  const stepIndex = new Map<string, string>(); // `${parentId}::${normTitle}` -> taskId

  for (const task of workspace.tasks) {
    if (!task.content) continue;
    const normTitle = normalizeTitle(task.content);

    if (!task.parent_id) {
      // Root task: index by (projectId ?? "inbox")::(normTitle)::(isCompleted)
      const isInboxTask =
        !task.project_id || task.project_id === inboxProjectId;
      if (isInboxTask) {
        rootIndex.set(
          `${INBOX_KEY}::${normTitle}::${task.is_completed}`,
          task.id,
        );
        if (inboxProjectId) {
          rootIndex.set(
            `${inboxProjectId}::${normTitle}::${task.is_completed}`,
            task.id,
          );
        }
      } else {
        rootIndex.set(
          `${task.project_id}::${normTitle}::${task.is_completed}`,
          task.id,
        );
      }
    } else {
      // Child step / subtask: index by (parentId)::(normTitle)
      stepIndex.set(`${task.parent_id}::${normTitle}`, task.id);
    }
  }

  return { inboxProjectId, rootIndex, stepIndex };
}

/**
 * Plans a Microsoft Tasks import against an existing Kagelin workspace.
 *
 * - Indexes projects by normalized name and maps `defaultList` to Inbox.
 * - Deduplicates root tasks against existing workspace tasks by `(project_id, normalized_title, is_completed)`.
 * - Populates `parentRedirects` map to redirect child checklist Steps to existing Kagelin root tasks.
 * - Deduplicates child checklist Steps by normalized title under parent tasks.
 */
export function planMicrosoftTasksImport(
  dataset: MicrosoftTasksDataset,
  workspace: ExistingWorkspace = { projects: [], tasks: [] },
): MicrosoftTasksImportPreview {
  const { inboxProjectId, rootIndex, stepIndex } = indexWorkspace(workspace);

  // Index existing non-inbox projects by normalized name
  const existingProjectsByName = new Map<string, string>();
  for (const project of workspace.projects) {
    if (project.is_inbox || !project.name) continue;
    existingProjectsByName.set(normalizeName(project.name), project.id);
  }

  const projectPlans: MicrosoftTasksProjectPlan[] = [];
  let paletteIndex = 0;

  // Process lists in dataset.lists, plus any extra listIds in dataset.tasksByListId
  const processedListIds = new Set<string>();
  const allLists = [...dataset.lists];
  for (const list of dataset.lists) {
    processedListIds.add(list.id);
  }
  for (const [listId] of Object.entries(dataset.tasksByListId)) {
    if (!processedListIds.has(listId)) {
      allLists.push({
        id: listId,
        displayName: listId,
        isOwner: true,
        isShared: false,
        wellknownListName: "none",
        tasks: [],
      });
      processedListIds.add(listId);
    }
  }

  for (const list of allLists) {
    const rawTasks = dataset.tasksByListId[list.id] ?? list.tasks ?? [];
    const mappedTasks = mapMicrosoftTaskList(rawTasks, list.id);
    if (mappedTasks.length === 0) continue;

    const isDefaultWellknown = list.wellknownListName === "defaultList";
    const isDefaultId = list.id === "defaultList";
    const isTasksOrInboxName =
      normalizeName(list.displayName) === "tasks" ||
      normalizeName(list.displayName) === "inbox";
    const isInbox = isDefaultWellknown || isDefaultId || isTasksOrInboxName;

    let name = list.displayName.trim();
    if (isInbox) {
      name =
        !name || name === "defaultList" || normalizeName(name) === "tasks"
          ? "Inbox"
          : name;
    } else if (!name) {
      name = "Untitled List";
    }

    let action: "create" | "merge";
    let status: "inbox" | "new" | "merged";
    let existingProjectId: string | null = null;
    let projectKey: string | null = null;

    if (isInbox) {
      action = "merge";
      status = "inbox";
      existingProjectId = inboxProjectId ?? null;
      projectKey = INBOX_KEY;
    } else {
      const matchedId = existingProjectsByName.get(normalizeName(name));
      if (matchedId) {
        action = "merge";
        status = "merged";
        existingProjectId = matchedId;
        projectKey = matchedId;
      } else {
        action = "create";
        status = "new";
        existingProjectId = null;
        projectKey = null;
      }
    }

    // Deduplication within this list
    const parentRedirects: Record<string, ParentRedirect> = {};
    const keptTaskIds = new Set<string>();
    const keptRootKeys = new Map<string, string>(); // `${normTitle}::${isCompleted}` -> tempId
    const keptStepsByParent = new Map<string, Set<string>>(); // parentId -> Set of normTitle
    let duplicatesSkipped = 0;
    let stepsReassigned = 0;

    const roots = mappedTasks.filter((t) => !t.isStep && !t.tempParentId);
    const steps = mappedTasks.filter(
      (t) => t.isStep || Boolean(t.tempParentId),
    );

    // 1. Process root tasks
    for (const root of roots) {
      const normTitle = normalizeTitle(root.content);
      const rootKey = `${normTitle}::${root.isCompleted}`;

      // Check if it duplicates an existing workspace root task
      const existingTaskId = projectKey
        ? rootIndex.get(`${projectKey}::${rootKey}`)
        : undefined;

      // Check if it duplicates an already kept root in this import list
      const importedRootTempId = keptRootKeys.get(rootKey);

      if (existingTaskId) {
        duplicatesSkipped++;
        parentRedirects[root.tempId] = {
          kind: "existing",
          taskId: existingTaskId,
        };
      } else if (importedRootTempId) {
        duplicatesSkipped++;
        parentRedirects[root.tempId] = {
          kind: "imported",
          tempId: importedRootTempId,
        };
      } else {
        keptRootKeys.set(rootKey, root.tempId);
        keptTaskIds.add(root.tempId);
      }
    }

    // 2. Process child checklist Steps
    for (const step of steps) {
      const normTitle = normalizeTitle(step.content);
      const tempParentId = step.tempParentId!;

      const redirect = parentRedirects[tempParentId];

      if (redirect) {
        if (redirect.kind === "existing") {
          const existingParentId = redirect.taskId;
          const isWorkspaceDuplicate = stepIndex.has(
            `${existingParentId}::${normTitle}`,
          );
          const isImportDuplicate = keptStepsByParent
            .get(existingParentId)
            ?.has(normTitle);

          if (isWorkspaceDuplicate || isImportDuplicate) {
            duplicatesSkipped++;
          } else {
            stepsReassigned++;
            step.parentId = existingParentId;
            keptTaskIds.add(step.tempId);

            let set = keptStepsByParent.get(existingParentId);
            if (!set) {
              set = new Set<string>();
              keptStepsByParent.set(existingParentId, set);
            }
            set.add(normTitle);
          }
        } else if (redirect.kind === "imported") {
          const targetTempId = redirect.tempId;
          const isImportDuplicate = keptStepsByParent
            .get(targetTempId)
            ?.has(normTitle);

          if (isImportDuplicate) {
            duplicatesSkipped++;
          } else {
            stepsReassigned++;
            step.parentId = targetTempId;
            step.tempParentId = targetTempId;
            keptTaskIds.add(step.tempId);

            let set = keptStepsByParent.get(targetTempId);
            if (!set) {
              set = new Set<string>();
              keptStepsByParent.set(targetTempId, set);
            }
            set.add(normTitle);
          }
        }
      } else {
        // Parent is a kept root task in this import
        const isImportDuplicate = keptStepsByParent
          .get(tempParentId)
          ?.has(normTitle);

        if (isImportDuplicate) {
          duplicatesSkipped++;
        } else {
          keptTaskIds.add(step.tempId);

          let set = keptStepsByParent.get(tempParentId);
          if (!set) {
            set = new Set<string>();
            keptStepsByParent.set(tempParentId, set);
          }
          set.add(normTitle);
        }
      }
    }

    // Preserve original traversal order among kept tasks
    const keptTasks = mappedTasks.filter((t) => keptTaskIds.has(t.tempId));

    projectPlans.push({
      listId: list.id,
      name,
      isInbox,
      action,
      status,
      color: PROJECT_COLORS[paletteIndex % PROJECT_COLORS.length].hex,
      existingProjectId,
      tasks: keptTasks,
      duplicatesSkipped,
      parentRedirects,
      stepsReassigned,
    });
    paletteIndex++;
  }

  // Calculate totals and date boundaries
  const allKeptTasks = projectPlans.flatMap((p) => p.tasks);
  const rootTasks = allKeptTasks.filter((t) => !t.isStep && !t.tempParentId);
  const steps = allKeptTasks.filter((t) => t.isStep || Boolean(t.tempParentId));
  const dates: string[] = [];

  for (const task of allKeptTasks) {
    if (task.dueDate) {
      dates.push(task.dueDate);
    }
  }

  dates.sort();

  return {
    kind: MICROSOFT_TASKS_PREVIEW_KIND,
    projects: projectPlans,
    tasks: allKeptTasks,
    totalLists: projectPlans.length,
    totalTasks: rootTasks.length,
    totalSteps: steps.length,
    totalCompleted: allKeptTasks.filter((t) => t.isCompleted).length,
    duplicatesCount: projectPlans.reduce(
      (sum, p) => sum + p.duplicatesSkipped,
      0,
    ),
    rootTasksCount: rootTasks.length,
    subtasksCount: steps.length,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    newProjectCount: projectPlans.filter((p) => p.status === "new").length,
    mergedProjectCount: projectPlans.filter((p) => p.status === "merged")
      .length,
    stepsReassigned: projectPlans.reduce(
      (sum, p) => sum + p.stepsReassigned,
      0,
    ),
    rawSource: dataset,
  };
}
