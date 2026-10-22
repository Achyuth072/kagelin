import { PROJECT_COLORS } from "@/lib/constants/colors";
import { parseTodoistCsv } from "./parser";
import { mapTodoistRowsToKagelin, type MappedTodoistTask } from "./mapper";
import type { TodoistCsvFile } from "./archive";
import {
  TODOIST_ARCHIVE_PREVIEW_KIND,
  type ExistingWorkspace,
  type ParseTodoistResult,
  type TodoistRow,
} from "./types";

export type TodoistProjectStatus = "inbox" | "new" | "merged";

// The replacement is always a root task: the UI shows one level of subtasks.
export type ParentRedirect =
  { kind: "existing"; taskId: string } | { kind: "imported"; tempId: string };

export interface TodoistProjectPlan {
  name: string;
  isInbox: boolean;
  status: TodoistProjectStatus;
  viewStyle: "list" | "board";
  color: string;
  existingProjectId: string | null;
  tasks: MappedTodoistTask[];
  duplicatesSkipped: number;
  /** tempId of a skipped duplicate -> the task that now holds its subtasks. */
  parentRedirects: Record<string, ParentRedirect>;
  subtasksReassigned: number;
}

export interface TodoistFileFailure {
  fileName: string;
  message: string;
}

export interface TodoistArchiveImportPreview {
  kind: typeof TODOIST_ARCHIVE_PREVIEW_KIND;
  projects: TodoistProjectPlan[];
  totalTasks: number;
  rootTasksCount: number;
  subtasksCount: number;
  recurringCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  newProjectCount: number;
  mergedProjectCount: number;
  duplicateTasksSkipped: number;
  subtasksReassigned: number;
  failedFiles: TodoistFileFailure[];
  rawSource: {
    files: Array<{
      fileName: string;
      meta: ParseTodoistResult["meta"];
      rows: TodoistRow[];
    }>;
  };
}

const INBOX_KEY = "__inbox__";

export function isArchivePreview(
  preview: unknown,
): preview is TodoistArchiveImportPreview {
  return (
    typeof preview === "object" &&
    preview !== null &&
    (preview as { kind?: unknown }).kind === TODOIST_ARCHIVE_PREVIEW_KIND
  );
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeContent(content: string): string {
  return content.trim();
}

interface ParsedFile {
  file: TodoistCsvFile;
  meta: ParseTodoistResult["meta"];
  rows: TodoistRow[];
  tasks: MappedTodoistTask[];
}

// One unreadable file must not cost the user the rest of the backup.
function parseFiles(
  files: TodoistCsvFile[],
  refDate: Date,
): { parsed: ParsedFile[]; failures: TodoistFileFailure[] } {
  const parsed: ParsedFile[] = [];
  const failures: TodoistFileFailure[] = [];

  for (const file of files) {
    if (!file.csvContent.trim()) continue;
    try {
      const result = parseTodoistCsv(file.csvContent);
      const mapped = mapTodoistRowsToKagelin(result.rows, refDate);
      parsed.push({
        file,
        meta: result.meta,
        rows: result.rows,
        tasks: mapped.tasks,
      });
    } catch (error) {
      failures.push({
        fileName: file.fileName,
        message:
          error instanceof Error ? error.message : "Could not parse file",
      });
    }
  }

  return { parsed, failures };
}

// `contents` holds every active task; `rootOwners` maps a title to its root.
interface ProjectContentIndex {
  contents: Map<string, string>;
  rootOwners: Map<string, string>;
}

function indexExistingContents(
  workspace: ExistingWorkspace,
): Map<string, ProjectContentIndex> {
  const index = new Map<string, ProjectContentIndex>();
  const activeTasks = workspace.tasks.filter(
    (task) => !task.is_completed && task.content,
  );
  const byId = new Map(activeTasks.map((task) => [task.id, task]));

  const rootOf = (task: (typeof activeTasks)[number]) => {
    let current = task;
    const visited = new Set<string>();
    while (current.parent_id && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = byId.get(current.parent_id);
      if (!parent) break;
      current = parent;
    }
    return current;
  };

  for (const task of activeTasks) {
    const key = task.project_id ?? INBOX_KEY;
    let bucket = index.get(key);
    if (!bucket) {
      bucket = { contents: new Map(), rootOwners: new Map() };
      index.set(key, bucket);
    }
    const content = normalizeContent(task.content!);
    if (!bucket.contents.has(content)) {
      bucket.contents.set(content, task.id);
    }
    const root = rootOf(task);
    if (!bucket.rootOwners.has(content)) {
      bucket.rootOwners.set(content, root.id);
    }
  }

  return index;
}

function mergeContentIndexes(
  ...indexes: Array<ProjectContentIndex | undefined>
): ProjectContentIndex | undefined {
  const contents = new Map<string, string>();
  const rootOwners = new Map<string, string>();

  for (const index of indexes) {
    if (!index) continue;
    for (const [content, taskId] of index.contents) {
      if (!contents.has(content)) contents.set(content, taskId);
    }
    for (const [content, rootId] of index.rootOwners) {
      if (!rootOwners.has(content)) rootOwners.set(content, rootId);
    }
  }

  return contents.size > 0 ? { contents, rootOwners } : undefined;
}

interface DedupeOutcome {
  kept: MappedTodoistTask[];
  duplicatesSkipped: number;
  parentRedirects: Record<string, ParentRedirect>;
}

// A dropped root task does not take its subtasks down with it.
function dedupeTasks(
  tasks: MappedTodoistTask[],
  seed: ProjectContentIndex | undefined,
): DedupeOutcome {
  // Nothing to merge into, so nothing to deduplicate against.
  if (!seed) {
    return { kept: [...tasks], duplicatesSkipped: 0, parentRedirects: {} };
  }

  const keptContents = new Set<string>();
  const keptRootContents = new Map<string, string>();
  // Lets a root that duplicates a subtask hand its subtasks to that parent.
  const keptSubtaskParents = new Map<string, string | null>();
  const kept: MappedTodoistTask[] = [];
  const parentRedirects: Record<string, ParentRedirect> = {};
  let duplicatesSkipped = 0;

  for (const task of tasks) {
    const content = normalizeContent(task.content);
    const isRoot = !task.tempParentId;

    if (seed.contents.has(content) || keptContents.has(content)) {
      duplicatesSkipped++;
      if (isRoot) {
        const owner = seed.rootOwners.get(content);
        if (owner) {
          parentRedirects[task.tempId] = {
            kind: "existing",
            taskId: owner,
          };
        } else {
          const keptRoot = keptRootContents.get(content);
          if (keptRoot) {
            parentRedirects[task.tempId] = {
              kind: "imported",
              tempId: keptRoot,
            };
          } else if (keptSubtaskParents.has(content)) {
            const parentTempId = keptSubtaskParents.get(content);
            if (parentTempId) {
              parentRedirects[task.tempId] = {
                kind: "imported",
                tempId: parentTempId,
              };
            }
          }
        }
      }
      continue;
    }

    keptContents.add(content);
    if (isRoot) {
      keptRootContents.set(content, task.tempId);
    } else {
      keptSubtaskParents.set(content, task.tempParentId);
    }
    kept.push(task);
  }

  return { kept, duplicatesSkipped, parentRedirects };
}

export function summarizeTasks(tasks: MappedTodoistTask[]): {
  rootTasksCount: number;
  subtasksCount: number;
  recurringCount: number;
  earliestDate: string | null;
  latestDate: string | null;
} {
  let rootTasksCount = 0;
  let subtasksCount = 0;
  let recurringCount = 0;
  const dates: string[] = [];

  for (const task of tasks) {
    if (task.tempParentId) subtasksCount++;
    else rootTasksCount++;
    if (task.recurrence) recurringCount++;
    if (task.dueDate) dates.push(task.dueDate);
    if (task.doDate) dates.push(task.doDate);
  }

  dates.sort();
  return {
    rootTasksCount,
    subtasksCount,
    recurringCount,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
  };
}

// The existing projects an import writes into, used to scope the task fetch.
export function resolveImportTargetProjectIds(
  files: TodoistCsvFile[],
  projects: ExistingWorkspace["projects"],
): string[] {
  const importedNames = new Set(
    files.map((file) =>
      normalizeName(file.isInbox ? "Inbox" : file.projectName),
    ),
  );

  const ids: string[] = [];
  for (const project of projects) {
    if (!project.name) continue;
    if (project.is_inbox || importedNames.has(normalizeName(project.name))) {
      ids.push(project.id);
    }
  }
  return ids;
}

export function buildTodoistImportPlan(
  files: TodoistCsvFile[],
  workspace: ExistingWorkspace = { projects: [], tasks: [] },
  refDate: Date = new Date(),
): TodoistArchiveImportPreview {
  const { parsed: parsedFiles, failures } = parseFiles(files, refDate);

  const groups = new Map<
    string,
    { name: string; isInbox: boolean; files: ParsedFile[] }
  >();
  for (const parsed of parsedFiles) {
    const isInbox = parsed.file.isInbox;
    const name = isInbox ? "Inbox" : parsed.file.projectName;
    const key = normalizeName(name);
    let group = groups.get(key);
    if (!group) {
      group = { name, isInbox, files: [] };
      groups.set(key, group);
    }
    group.files.push(parsed);
  }

  const inboxProjectId =
    workspace.projects.find((project) => project.is_inbox)?.id ?? null;
  const existingByName = new Map<string, string>();
  for (const project of workspace.projects) {
    if (project.is_inbox || !project.name) continue;
    existingByName.set(normalizeName(project.name), project.id);
  }
  const existingContents = indexExistingContents(workspace);

  const projects: TodoistProjectPlan[] = [];
  let paletteIndex = 0;

  for (const group of groups.values()) {
    const tasks = group.files.flatMap((parsed) => parsed.tasks);

    let status: TodoistProjectStatus;
    let existingProjectId: string | null;
    let seed: ProjectContentIndex | undefined;

    if (group.isInbox) {
      status = "inbox";
      existingProjectId = null;
      seed = mergeContentIndexes(
        existingContents.get(INBOX_KEY),
        inboxProjectId ? existingContents.get(inboxProjectId) : undefined,
      );
    } else {
      const matched = existingByName.get(normalizeName(group.name));
      if (matched) {
        status = "merged";
        existingProjectId = matched;
        seed = existingContents.get(matched);
      } else {
        status = "new";
        existingProjectId = null;
      }
    }

    const { kept, duplicatesSkipped, parentRedirects } = dedupeTasks(
      tasks,
      seed,
    );

    projects.push({
      name: group.name,
      isInbox: group.isInbox,
      status,
      viewStyle:
        group.files.find((parsed) => parsed.meta.viewStyle)?.meta.viewStyle ??
        "list",
      color: PROJECT_COLORS[paletteIndex % PROJECT_COLORS.length].hex,
      existingProjectId,
      tasks: kept,
      duplicatesSkipped,
      parentRedirects,
      subtasksReassigned: countReassignedSubtasks(kept, parentRedirects),
    });
    paletteIndex++;
  }

  const totals = summarizeTasks(projects.flatMap((project) => project.tasks));

  return {
    kind: TODOIST_ARCHIVE_PREVIEW_KIND,
    projects,
    totalTasks: totals.rootTasksCount + totals.subtasksCount,
    ...totals,
    newProjectCount: projects.filter((p) => p.status === "new").length,
    mergedProjectCount: projects.filter((p) => p.status === "merged").length,
    duplicateTasksSkipped: projects.reduce(
      (sum, project) => sum + project.duplicatesSkipped,
      0,
    ),
    subtasksReassigned: projects.reduce(
      (sum, project) => sum + project.subtasksReassigned,
      0,
    ),
    failedFiles: failures,
    rawSource: {
      files: parsedFiles.map((parsed) => ({
        fileName: parsed.file.fileName,
        meta: parsed.meta,
        rows: parsed.rows,
      })),
    },
  };
}

function countReassignedSubtasks(
  kept: MappedTodoistTask[],
  parentRedirects: Record<string, ParentRedirect>,
): number {
  const redirectedParents = new Set(Object.keys(parentRedirects));
  let count = 0;
  for (const task of kept) {
    if (task.tempParentId && redirectedParents.has(task.tempParentId)) {
      count++;
    }
  }
  return count;
}
