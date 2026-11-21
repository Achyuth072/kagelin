import { PROJECT_COLORS } from "@/lib/constants/colors";
import { mapGoogleTaskList } from "./mapper";
import {
  GOOGLE_TASKS_PREVIEW_KIND,
  type GoogleTasksDataset,
  type GoogleTasksImportPreview,
  type GoogleTasksProjectPlan,
  type ExistingWorkspace,
  type ParentRedirect,
} from "./types";

const INBOX_KEY = "__inbox__";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function indexWorkspace(workspace: ExistingWorkspace) {
  const inboxProjectId = workspace.projects.find((p) => p.is_inbox)?.id ?? null;

  const rootIndex = new Map<string, string>();
  const subtaskIndex = new Map<string, string>();

  const activeTasks = workspace.tasks.filter(
    (task) => !task.is_completed && task.content,
  );

  for (const task of activeTasks) {
    const normTitle = normalizeTitle(task.content!);
    if (!task.parent_id) {
      const isInboxTask =
        !task.project_id || task.project_id === inboxProjectId;
      if (isInboxTask) {
        rootIndex.set(`${INBOX_KEY}:${normTitle}`, task.id);
        if (inboxProjectId) {
          rootIndex.set(`${inboxProjectId}:${normTitle}`, task.id);
        }
      } else {
        rootIndex.set(`${task.project_id}:${normTitle}`, task.id);
      }
    } else {
      subtaskIndex.set(`${task.parent_id}:${normTitle}`, task.id);
    }
  }

  return { inboxProjectId, rootIndex, subtaskIndex };
}

export function planGoogleTasksImport(
  dataset: GoogleTasksDataset,
  workspace: ExistingWorkspace = { projects: [], tasks: [] },
): GoogleTasksImportPreview {
  const { inboxProjectId, rootIndex, subtaskIndex } = indexWorkspace(workspace);

  const existingProjectsByName = new Map<string, string>();
  for (const project of workspace.projects) {
    if (project.is_inbox || !project.name) continue;
    existingProjectsByName.set(normalizeName(project.name), project.id);
  }

  const projectPlans: GoogleTasksProjectPlan[] = [];
  let paletteIndex = 0;

  const processedListIds = new Set<string>();
  const allLists = [...dataset.lists];
  for (const list of dataset.lists) {
    processedListIds.add(list.id);
  }
  for (const [listId] of Object.entries(dataset.tasksByListId)) {
    if (!processedListIds.has(listId)) {
      allLists.push({ id: listId, title: listId });
      processedListIds.add(listId);
    }
  }

  for (const list of allLists) {
    const rawTasks = dataset.tasksByListId[list.id] ?? [];
    const mappedTasks = mapGoogleTaskList(rawTasks, list.id);
    if (mappedTasks.length === 0) continue;

    const isInbox = list.id === "@default";

    let name = list.title.trim();
    if (isInbox) {
      name = !name || name === "@default" ? "Inbox" : name;
    } else if (!name) {
      name = "Untitled List";
    }

    let status: "inbox" | "new" | "merged";
    let existingProjectId: string | null = null;
    let projectKey: string | null = null;

    if (isInbox) {
      status = "inbox";
      existingProjectId = inboxProjectId ?? null;
      projectKey = INBOX_KEY;
    } else {
      const matchedId = existingProjectsByName.get(normalizeName(name));
      if (matchedId) {
        status = "merged";
        existingProjectId = matchedId;
        projectKey = matchedId;
      } else {
        status = "new";
        existingProjectId = null;
        projectKey = null;
      }
    }

    const parentRedirects: Record<string, ParentRedirect> = {};
    const keptTaskIds = new Set<string>();
    const keptRootTitles = new Map<string, string>();
    const keptSubtasksByParent = new Map<string, Set<string>>();
    let duplicatesSkipped = 0;
    let subtasksReassigned = 0;

    const roots = mappedTasks.filter((t) => !t.tempParentId);
    const subtasks = mappedTasks.filter((t) => Boolean(t.tempParentId));

    for (const root of roots) {
      const normTitle = normalizeTitle(root.content);

      const existingTaskId = projectKey
        ? rootIndex.get(`${projectKey}:${normTitle}`)
        : undefined;

      const importedRootTempId = keptRootTitles.get(normTitle);

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
        keptRootTitles.set(normTitle, root.tempId);
        keptTaskIds.add(root.tempId);
      }
    }

    for (const subtask of subtasks) {
      const normTitle = normalizeTitle(subtask.content);
      const tempParentId = subtask.tempParentId!;

      const redirect = parentRedirects[tempParentId];

      if (redirect) {
        if (redirect.kind === "existing") {
          const existingParentId = redirect.taskId;

          const isWorkspaceDuplicate = subtaskIndex.has(
            `${existingParentId}:${normTitle}`,
          );
          const isImportDuplicate = keptSubtasksByParent
            .get(existingParentId)
            ?.has(normTitle);

          if (isWorkspaceDuplicate || isImportDuplicate) {
            duplicatesSkipped++;
          } else {
            subtasksReassigned++;
            subtask.parentId = existingParentId;
            keptTaskIds.add(subtask.tempId);

            let set = keptSubtasksByParent.get(existingParentId);
            if (!set) {
              set = new Set<string>();
              keptSubtasksByParent.set(existingParentId, set);
            }
            set.add(normTitle);
          }
        } else if (redirect.kind === "imported") {
          const targetTempId = redirect.tempId;
          const isImportDuplicate = keptSubtasksByParent
            .get(targetTempId)
            ?.has(normTitle);

          if (isImportDuplicate) {
            duplicatesSkipped++;
          } else {
            subtasksReassigned++;
            subtask.parentId = targetTempId;
            subtask.tempParentId = targetTempId;
            keptTaskIds.add(subtask.tempId);

            let set = keptSubtasksByParent.get(targetTempId);
            if (!set) {
              set = new Set<string>();
              keptSubtasksByParent.set(targetTempId, set);
            }
            set.add(normTitle);
          }
        }
      } else {
        const isImportDuplicate = keptSubtasksByParent
          .get(tempParentId)
          ?.has(normTitle);

        if (isImportDuplicate) {
          duplicatesSkipped++;
        } else {
          keptTaskIds.add(subtask.tempId);

          let set = keptSubtasksByParent.get(tempParentId);
          if (!set) {
            set = new Set<string>();
            keptSubtasksByParent.set(tempParentId, set);
          }
          set.add(normTitle);
        }
      }
    }

    const keptTasks = mappedTasks.filter((t) => keptTaskIds.has(t.tempId));

    projectPlans.push({
      listId: list.id,
      name,
      isInbox,
      status,
      color: PROJECT_COLORS[paletteIndex % PROJECT_COLORS.length].hex,
      existingProjectId,
      tasks: keptTasks,
      duplicatesSkipped,
      parentRedirects,
      subtasksReassigned,
    });
    paletteIndex++;
  }

  const allKeptTasks = projectPlans.flatMap((p) => p.tasks);
  let rootTasksCount = 0;
  let subtasksCount = 0;
  const dates: string[] = [];

  for (const task of allKeptTasks) {
    if (task.tempParentId || task.originalDepth > 0) {
      subtasksCount++;
    } else {
      rootTasksCount++;
    }
    if (task.dueDate) {
      dates.push(task.dueDate);
    }
  }

  dates.sort();

  return {
    kind: GOOGLE_TASKS_PREVIEW_KIND,
    projects: projectPlans,
    totalTasks: allKeptTasks.length,
    rootTasksCount,
    subtasksCount,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    newProjectCount: projectPlans.filter((p) => p.status === "new").length,
    mergedProjectCount: projectPlans.filter((p) => p.status === "merged")
      .length,
    duplicateTasksSkipped: projectPlans.reduce(
      (sum, p) => sum + p.duplicatesSkipped,
      0,
    ),
    subtasksReassigned: projectPlans.reduce(
      (sum, p) => sum + p.subtasksReassigned,
      0,
    ),
    rawSource: dataset,
  };
}
