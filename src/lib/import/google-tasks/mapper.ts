import {
  type GoogleTaskResource,
  type GoogleTasksDataset,
  type MappedGoogleTask,
} from "./types";

export interface MapGoogleTasksResult {
  tasks: MappedGoogleTask[];
  tasksByListId: Record<string, MappedGoogleTask[]>;
}

export function parseGoogleTaskDueDate(
  dueStr?: string | null,
): string | undefined {
  if (!dueStr) return undefined;
  const datePartMatch = /^(\d{4}-\d{2}-\d{2})/.exec(dueStr.trim());
  if (!datePartMatch) return undefined;
  const datePart = datePartMatch[1];
  return `${datePart}T00:00:00.000Z`;
}

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
