import { PROJECT_COLORS } from "@/lib/constants/colors";
import type {
  MappedTickTickTask,
  TickTickProjectPlan,
  TickTickImportPreview,
  ExistingWorkspace,
  ParentRedirect,
  PlanTickTickImportOptions,
} from "./types";

const INBOX_KEY = "inbox";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function rootFingerprint(
  projectKey: string,
  normTitle: string,
  isCompleted: boolean,
  date?: string | null,
): string {
  const normDate = date ? date.split("T")[0] : "";
  return `${projectKey}:${normTitle}:${isCompleted}:${normDate}`;
}

function childFingerprint(
  parentId: string,
  normTitle: string,
  isCompleted: boolean,
): string {
  return `${parentId}:${normTitle}:${isCompleted}`;
}

function recordKeptStep(
  map: Map<string, Set<string>>,
  parentId: string,
  stepKey: string,
  step: MappedTickTickTask,
  targetList: MappedTickTickTask[],
) {
  let set = map.get(parentId);
  if (!set) {
    set = new Set<string>();
    map.set(parentId, set);
  }
  set.add(stepKey);
  targetList.push(step);
}

function indexWorkspace(workspace: ExistingWorkspace) {
  const inboxProjectId = workspace.projects.find((p) => p.is_inbox)?.id ?? null;

  const rootIndex = new Map<string, string>();
  const stepIndex = new Map<string, string>();

  for (const task of workspace.tasks) {
    if (!task.content) continue;
    const normTitle = normalizeTitle(task.content);
    const isCompleted = Boolean(task.is_completed);
    const date = task.due_date || task.do_date || null;

    if (!task.parent_id) {
      const isInboxTask =
        !task.project_id || task.project_id === inboxProjectId;
      if (isInboxTask) {
        rootIndex.set(
          rootFingerprint(INBOX_KEY, normTitle, isCompleted, date),
          task.id,
        );
        if (inboxProjectId) {
          rootIndex.set(
            rootFingerprint(inboxProjectId, normTitle, isCompleted, date),
            task.id,
          );
        }
      } else if (task.project_id) {
        rootIndex.set(
          rootFingerprint(task.project_id, normTitle, isCompleted, date),
          task.id,
        );
      }
    } else {
      stepIndex.set(
        childFingerprint(task.parent_id, normTitle, isCompleted),
        task.id,
      );
    }
  }

  return { inboxProjectId, rootIndex, stepIndex };
}

export function formatProjectName(
  listName: string,
  folderName?: string | null,
): { name: string; isInbox: boolean } {
  const trimmedList = listName.trim();
  const trimmedFolder = folderName?.trim() || "";

  if (!trimmedList || trimmedList.toLowerCase() === "inbox") {
    return { name: "Inbox", isInbox: true };
  }

  if (trimmedFolder) {
    return {
      name: `${trimmedFolder} / ${trimmedList}`,
      isInbox: false,
    };
  }

  return { name: trimmedList, isInbox: false };
}

export function planTickTickImport(
  tasks: MappedTickTickTask[],
  workspace: ExistingWorkspace = { projects: [], tasks: [] },
  options: PlanTickTickImportOptions = {},
): TickTickImportPreview {
  const refDate = options.refDate ?? new Date();
  const isGuest = options.isGuest ?? false;

  const isQuotaLimited = isGuest && tasks.length > 500;
  let candidateTasks = tasks;

  if (isQuotaLimited) {
    const thirtyDaysAgoMs = refDate.getTime() - 30 * 24 * 60 * 60 * 1000;
    const keptTempIds = new Set<string>();

    for (const task of tasks) {
      if (!task.is_completed) {
        keptTempIds.add(task.tempId);
      } else {
        const dateStr = task.completedAt ?? task.dueDate ?? task.doDate;
        if (dateStr) {
          const dateMs = new Date(dateStr).getTime();
          if (!isNaN(dateMs) && dateMs >= thirtyDaysAgoMs) {
            keptTempIds.add(task.tempId);
          }
        }
      }
    }

    // Drop child steps whose parents were pruned by quota limit
    candidateTasks = tasks.filter((task) => {
      if (!keptTempIds.has(task.tempId)) return false;
      if (task.tempParentId && !keptTempIds.has(task.tempParentId)) {
        return false;
      }
      return true;
    });
  }

  const { inboxProjectId, rootIndex, stepIndex } = indexWorkspace(workspace);

  const existingProjectsByName = new Map<string, string>();
  for (const project of workspace.projects) {
    if (project.is_inbox || !project.name) continue;
    existingProjectsByName.set(normalizeName(project.name), project.id);
  }

  interface ProjectGroup {
    name: string;
    folderName: string | null;
    isInbox: boolean;
    tasks: MappedTickTickTask[];
  }

  const groupMap = new Map<string, ProjectGroup>();

  for (const task of candidateTasks) {
    const { name, isInbox } = formatProjectName(task.listName, task.folderName);
    const key = isInbox ? INBOX_KEY : normalizeName(name);

    let group = groupMap.get(key);
    if (!group) {
      group = {
        name,
        folderName: isInbox ? null : task.folderName?.trim() || null,
        isInbox,
        tasks: [],
      };
      groupMap.set(key, group);
    }
    group.tasks.push(task);
  }

  const projectPlans: TickTickProjectPlan[] = [];
  const globalParentRedirects: Record<string, ParentRedirect> = {};
  let colorIndex = 0;

  for (const [, group] of groupMap) {
    let status: "inbox" | "new" | "merged";
    let existingProjectId: string | null = null;
    let projectKey: string | null = null;
    let displayName = group.name;

    if (group.isInbox) {
      status = "inbox";
      existingProjectId = inboxProjectId ?? null;
      projectKey = INBOX_KEY;
      displayName = "Inbox";
    } else {
      const matched = workspace.projects.find(
        (p) =>
          !p.is_inbox &&
          p.name &&
          normalizeName(p.name) === normalizeName(group.name),
      );
      if (matched) {
        status = "merged";
        existingProjectId = matched.id;
        projectKey = matched.id;
        displayName = matched.name;
      } else {
        status = "new";
        existingProjectId = null;
        projectKey = null;
      }
    }

    const parentRedirects: Record<string, ParentRedirect> = {};
    const keptRootFingerprints = new Map<string, string>();
    const keptStepsByParent = new Map<string, Set<string>>();
    const keptRoots: MappedTickTickTask[] = [];
    const keptSteps: MappedTickTickTask[] = [];
    let duplicatesSkipped = 0;
    let subtasksReassigned = 0;

    const roots = group.tasks.filter((t) => !t.tempParentId);
    const steps = group.tasks.filter((t) => Boolean(t.tempParentId));

    for (const root of roots) {
      const normTitle = normalizeTitle(root.content);
      const isCompleted = root.is_completed;
      const date = root.dueDate || root.doDate || null;
      const workspaceKey = projectKey
        ? rootFingerprint(projectKey, normTitle, isCompleted, date)
        : null;

      const existingTaskId = workspaceKey
        ? rootIndex.get(workspaceKey)
        : undefined;

      const intraBatchKey = rootFingerprint(
        group.isInbox ? INBOX_KEY : group.name,
        normTitle,
        isCompleted,
        date,
      );
      const importedRootTempId = keptRootFingerprints.get(intraBatchKey);

      if (existingTaskId) {
        duplicatesSkipped++;
        const redirect: ParentRedirect = {
          kind: "existing",
          taskId: existingTaskId,
        };
        parentRedirects[root.tempId] = redirect;
        globalParentRedirects[root.tempId] = redirect;
      } else if (importedRootTempId) {
        duplicatesSkipped++;
        const redirect: ParentRedirect = {
          kind: "imported",
          tempId: importedRootTempId,
        };
        parentRedirects[root.tempId] = redirect;
        globalParentRedirects[root.tempId] = redirect;
      } else {
        keptRootFingerprints.set(intraBatchKey, root.tempId);
        keptRoots.push(root);
      }
    }

    for (const step of steps) {
      const normTitle = normalizeTitle(step.content);
      const isCompleted = step.is_completed;
      const tempParentId = step.tempParentId!;
      const stepKey = `${normTitle}:${isCompleted}`;

      const redirect =
        parentRedirects[tempParentId] ?? globalParentRedirects[tempParentId];

      if (redirect) {
        if (redirect.kind === "existing") {
          const existingParentId = redirect.taskId;
          const isWorkspaceDuplicate = stepIndex.has(
            childFingerprint(existingParentId, normTitle, isCompleted),
          );
          const isImportDuplicate = keptStepsByParent
            .get(existingParentId)
            ?.has(stepKey);

          if (isWorkspaceDuplicate || isImportDuplicate) {
            duplicatesSkipped++;
          } else {
            subtasksReassigned++;
            step.originalParentId = existingParentId;
            recordKeptStep(
              keptStepsByParent,
              existingParentId,
              stepKey,
              step,
              keptSteps,
            );
          }
        } else if (redirect.kind === "imported") {
          const targetTempId = redirect.tempId;
          const isImportDuplicate = keptStepsByParent
            .get(targetTempId)
            ?.has(stepKey);

          if (isImportDuplicate) {
            duplicatesSkipped++;
          } else {
            subtasksReassigned++;
            step.tempParentId = targetTempId;
            recordKeptStep(
              keptStepsByParent,
              targetTempId,
              stepKey,
              step,
              keptSteps,
            );
          }
        }
      } else {
        const isImportDuplicate = keptStepsByParent
          .get(tempParentId)
          ?.has(stepKey);

        if (isImportDuplicate) {
          duplicatesSkipped++;
        } else {
          recordKeptStep(
            keptStepsByParent,
            tempParentId,
            stepKey,
            step,
            keptSteps,
          );
        }
      }
    }

    const assignedColor =
      PROJECT_COLORS[colorIndex % PROJECT_COLORS.length].hex;
    colorIndex++;

    projectPlans.push({
      name: displayName,
      folderName: group.folderName,
      status,
      isInbox: group.isInbox,
      existingProjectId,
      color: assignedColor,
      tasks: [...keptRoots, ...keptSteps],
      duplicatesSkipped,
      parentRedirects,
      subtasksReassigned,
    });
  }

  const allKeptTasks = projectPlans.flatMap((p) => p.tasks);
  let rootTasksCount = 0;
  let subtasksCount = 0;
  let completedTasksCount = 0;
  let recurringCount = 0;
  const dates: string[] = [];

  for (const task of allKeptTasks) {
    if (task.tempParentId) {
      subtasksCount++;
    } else {
      rootTasksCount++;
    }

    if (task.is_completed) {
      completedTasksCount++;
    }

    if (task.recurrence) {
      recurringCount++;
    }

    if (task.dueDate) dates.push(task.dueDate);
    if (task.doDate) dates.push(task.doDate);
    if (task.completedAt) dates.push(task.completedAt);
  }

  dates.sort();

  return {
    totalTasks: allKeptTasks.length,
    rootTasksCount,
    subtasksCount,
    completedTasksCount,
    recurringCount,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    projects: projectPlans,
    parentRedirects: globalParentRedirects,
    duplicateTasksSkipped: projectPlans.reduce(
      (sum, p) => sum + p.duplicatesSkipped,
      0,
    ),
    subtasksReassigned: projectPlans.reduce(
      (sum, p) => sum + p.subtasksReassigned,
      0,
    ),
    newProjectCount: projectPlans.filter((p) => p.status === "new").length,
    mergedProjectCount: projectPlans.filter((p) => p.status === "merged")
      .length,
    isQuotaLimited,
    rawSource: options.rawSource,
  };
}
