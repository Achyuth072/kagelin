import { PROJECT_COLORS } from "@/lib/constants/colors";
import { parseTodoistCsv } from "./parser";
import { mapTodoistRowsToKagelin, type MappedTodoistTask } from "./mapper";
import type { TodoistCsvFile } from "./archive";
import type {
  ExistingWorkspace,
  ParseTodoistResult,
  TodoistRow,
} from "./types";

export type TodoistProjectStatus = "inbox" | "new" | "merged";

export interface TodoistProjectPlan {
  name: string;
  isInbox: boolean;
  status: TodoistProjectStatus;
  viewStyle: "list" | "board";
  color: string;
  existingProjectId: string | null;
  tasks: MappedTodoistTask[];
  duplicatesSkipped: number;
}

export interface TodoistFileFailure {
  fileName: string;
  message: string;
}

export interface TodoistArchiveImportPreview {
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
    typeof preview === "object" && preview !== null && "projects" in preview
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

function indexExistingContents(
  workspace: ExistingWorkspace,
): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const task of workspace.tasks) {
    if (task.is_completed || !task.content) continue;
    const key = task.project_id ?? INBOX_KEY;
    let contents = index.get(key);
    if (!contents) {
      contents = new Set();
      index.set(key, contents);
    }
    contents.add(normalizeContent(task.content));
  }
  return index;
}

function dedupeTasks(
  tasks: MappedTodoistTask[],
  seed: Set<string> | undefined,
): { kept: MappedTodoistTask[]; skipped: number } {
  if (!seed || seed.size === 0) {
    return { kept: [...tasks], skipped: 0 };
  }

  const seen = new Set(seed);
  const skippedIds = new Set<string>();
  const kept: MappedTodoistTask[] = [];

  for (const task of tasks) {
    const parentSkipped =
      task.tempParentId != null && skippedIds.has(task.tempParentId);
    if (parentSkipped || seen.has(normalizeContent(task.content))) {
      skippedIds.add(task.tempId);
      continue;
    }
    seen.add(normalizeContent(task.content));
    kept.push(task);
  }

  return { kept, skipped: skippedIds.size };
}

function unionContents(
  ...sets: Array<Set<string> | undefined>
): Set<string> | undefined {
  const merged = new Set<string>();
  for (const set of sets) {
    if (!set) continue;
    for (const value of set) merged.add(value);
  }
  return merged.size > 0 ? merged : undefined;
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
    let seed: Set<string> | undefined;

    if (group.isInbox) {
      status = "inbox";
      existingProjectId = null;
      seed = unionContents(
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

    const { kept, skipped } = dedupeTasks(tasks, seed);

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
      duplicatesSkipped: skipped,
    });
    paletteIndex++;
  }

  const totals = summarizeTasks(projects.flatMap((project) => project.tasks));

  return {
    projects,
    totalTasks: totals.rootTasksCount + totals.subtasksCount,
    ...totals,
    newProjectCount: projects.filter((p) => p.status === "new").length,
    mergedProjectCount: projects.filter((p) => p.status === "merged").length,
    duplicateTasksSkipped: projects.reduce(
      (sum, project) => sum + project.duplicatesSkipped,
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
