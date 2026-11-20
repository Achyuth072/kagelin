import {
  type GoogleTaskResource,
  type GoogleTasksDataset,
  type MappedGoogleTask,
} from "./types";

export interface MapGoogleTasksResult {
  tasks: MappedGoogleTask[];
  tasksByListId: Record<string, MappedGoogleTask[]>;
}

/**
 * Google Tasks Timezone Safe Due Date Parser
 *
 * Extracts the calendar date part (YYYY-MM-DD) and anchors it directly to
 * UTC midnight without passing through local machine Date offsets to prevent
 * retrospective 1-day drift in Western timezones (UTC-1 through UTC-12).
 */
export function parseGoogleTaskDueDate(
  dueStr?: string | null,
): string | undefined {
  if (!dueStr) return undefined;
  const datePartMatch = /^(\d{4}-\d{2}-\d{2})/.exec(dueStr.trim());
  if (!datePartMatch) return undefined;
  const datePart = datePartMatch[1];
  return `${datePart}T00:00:00.000Z`;
}

/**
 * Compare sibling tasks by lexicographical position string (stable fallback to ID)
 */
function compareTaskPositions(
  a: GoogleTaskResource,
  b: GoogleTaskResource,
): number {
  const posA = a.position ?? "";
  const posB = b.position ?? "";
  if (posA !== posB) {
    return posA.localeCompare(posB);
  }
  return a.id.localeCompare(b.id);
}

/**
 * Maps a single Google Task list's raw tasks into Kagelin's flat/single-level subtask model.
 *
 * - Orders tasks deterministically using pre-order DFS on sibling-scoped `position` strings.
 * - Assigns contiguous 0-indexed integer `dayOrder`.
 * - Keeps `task.content = task.title.trim()` verbatim for title deduplication symmetry.
 * - Direct depth-1 subtasks keep their parentId set to the root task.
 * - Deep subtasks (depth >= 2) are reparented to the root ancestor, and ancestry
 *   breadcrumbs `[Context: Ancestor > Parent]` are prepended to `description`.
 */
export function mapGoogleTaskList(
  tasks: GoogleTaskResource[],
  listId: string,
): MappedGoogleTask[] {
  const taskMap = new Map<string, GoogleTaskResource>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const roots: GoogleTaskResource[] = [];
  const childrenMap = new Map<string, GoogleTaskResource[]>();

  for (const task of tasks) {
    const parentId =
      task.parent && taskMap.has(task.parent) ? task.parent : null;
    if (parentId) {
      const siblings = childrenMap.get(parentId) ?? [];
      siblings.push(task);
      childrenMap.set(parentId, siblings);
    } else {
      roots.push(task);
    }
  }

  // Sort siblings at every level
  roots.sort(compareTaskPositions);
  for (const siblings of childrenMap.values()) {
    siblings.sort(compareTaskPositions);
  }

  const mappedTasks: MappedGoogleTask[] = [];
  let currentDayOrder = 0;
  const visited = new Set<string>();

  function traverse(
    task: GoogleTaskResource,
    rootAncestorId: string | null,
    ancestorTitles: string[],
    depth: number,
  ) {
    if (visited.has(task.id)) return;
    visited.add(task.id);

    const content = task.title.trim();
    const trimmedNotes = task.notes?.trim() || "";

    let parentId: string | null = null;
    let description: string | null = null;
    let effectiveRootId = rootAncestorId;

    if (depth === 0) {
      parentId = null;
      effectiveRootId = task.id;
      description = trimmedNotes || null;
    } else if (depth === 1) {
      parentId = effectiveRootId;
      description = trimmedNotes || null;
    } else {
      // Depth >= 2: reparent to root ancestor and embed breadcrumb in description
      parentId = effectiveRootId;
      const breadcrumb = `[Context: ${ancestorTitles.join(" > ")}]`;
      description = trimmedNotes
        ? `${breadcrumb}\n${trimmedNotes}`
        : breadcrumb;
    }

    const dueDate = parseGoogleTaskDueDate(task.due) ?? null;
    const isCompleted = task.status === "completed";
    const completedAt = isCompleted && task.completed ? task.completed : null;

    mappedTasks.push({
      id: task.id,
      tempId: task.id,
      parentId,
      tempParentId: parentId,
      content,
      description,
      dueDate,
      isCompleted,
      completedAt,
      dayOrder: currentDayOrder++,
      listId,
      originalDepth: depth,
    });

    const children = childrenMap.get(task.id) ?? [];
    const nextAncestorTitles = [...ancestorTitles, task.title.trim()];

    for (const child of children) {
      traverse(child, effectiveRootId, nextAncestorTitles, depth + 1);
    }
  }

  for (const root of roots) {
    traverse(root, null, [], 0);
  }

  return mappedTasks;
}

/**
 * Maps an entire GoogleTasksDataset across all task lists into Kagelin's format.
 */
export function mapGoogleTasksToKagelin(
  dataset: GoogleTasksDataset,
): MapGoogleTasksResult {
  const allMappedTasks: MappedGoogleTask[] = [];
  const tasksByListId: Record<string, MappedGoogleTask[]> = {};

  const processedListIds = new Set<string>();

  for (const list of dataset.lists) {
    processedListIds.add(list.id);
    const rawTasks = dataset.tasksByListId[list.id] ?? [];
    const mapped = mapGoogleTaskList(rawTasks, list.id);
    tasksByListId[list.id] = mapped;
    allMappedTasks.push(...mapped);
  }

  // Also process any list IDs present in tasksByListId that weren't in lists array
  for (const [listId, rawTasks] of Object.entries(dataset.tasksByListId)) {
    if (!processedListIds.has(listId)) {
      const mapped = mapGoogleTaskList(rawTasks, listId);
      tasksByListId[listId] = mapped;
      allMappedTasks.push(...mapped);
    }
  }

  return {
    tasks: allMappedTasks,
    tasksByListId,
  };
}
