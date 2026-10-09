import { addDays, format } from "date-fns";
import type { Task, Project } from "@/lib/types/task";
import type { GroupOption } from "@/lib/types/sorting";
import { computeMoveOrders, computeReorderOrders } from "@/lib/utils/reorder";
import { UNREADABLE_LABEL } from "@/components/encryption/ReadableText";

export type TaskPlacement = Partial<
  Pick<Task, "due_date" | "do_date" | "is_evening" | "priority" | "project_id">
>;

// "Overdue" is derived with no settable property; cross-group drops cannot enter without back-dating.
export function isDropBlockedGroup(
  groupTitle: string,
  groupBy?: GroupOption,
): boolean {
  if (groupBy !== undefined && groupBy !== "date") return false;
  return groupTitle.toLowerCase() === "overdue";
}

const dateBucketUpdates = (groupKey: string): TaskPlacement | null => {
  const today = new Date();
  if (groupKey === "today") {
    const d = format(today, "yyyy-MM-dd");
    return { do_date: d, due_date: d };
  }
  if (groupKey === "tomorrow") {
    const d = format(addDays(today, 1), "yyyy-MM-dd");
    return { do_date: d, due_date: d };
  }
  if (groupKey === "upcoming") {
    const d = format(addDays(today, 2), "yyyy-MM-dd");
    return { do_date: d, due_date: d };
  }
  if (groupKey === "no date") {
    return { do_date: null, due_date: null };
  }
  return null;
};

const priorityBucketUpdates = (groupKey: string): TaskPlacement | null => {
  const priorities: Record<string, 1 | 2 | 3 | 4> = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  };
  return groupKey in priorities ? { priority: priorities[groupKey] } : null;
};

// The short id keeps two unreadable projects apart, since the title is also the group's key and drop target.
export function projectGroupTitle(
  project: Project | undefined,
  projectId: string,
): string {
  if (project?.name) return project.name;
  if (projectId === "inbox") return "Inbox";
  if (project) return `${UNREADABLE_LABEL} · ${projectId.slice(0, 6)}`;
  return projectId;
}

const projectBucketUpdates = (
  groupKey: string,
  projectsMap: Map<string, Project>,
): TaskPlacement | null => {
  if (groupKey === "inbox") return { project_id: null };
  for (const p of projectsMap.values()) {
    if (projectGroupTitle(p, p.id).toLowerCase() === groupKey) {
      return { project_id: p.id };
    }
  }
  return null;
};

const eveningBucketUpdates = (groupKey: string): TaskPlacement | null => {
  if (groupKey === "this evening") return { is_evening: true };
  if (groupKey === "active" || groupKey === "tasks") {
    return { is_evening: false };
  }
  return null;
};

// Maps group title to task updates; respects groupBy so names matching dates stay project-scoped.
export function getTaskUpdatesForGroup(
  groupTitle: string,
  projectsMap: Map<string, Project>,
  groupBy?: GroupOption,
): TaskPlacement {
  const groupKey = groupTitle.toLowerCase();

  switch (groupBy) {
    case "date":
      return dateBucketUpdates(groupKey) ?? {};
    case "priority":
      return priorityBucketUpdates(groupKey) ?? {};
    case "project":
      return projectBucketUpdates(groupKey, projectsMap) ?? {};
    case "none":
      return eveningBucketUpdates(groupKey) ?? {};
    default:
      return (
        dateBucketUpdates(groupKey) ??
        eveningBucketUpdates(groupKey) ??
        priorityBucketUpdates(groupKey) ??
        projectBucketUpdates(groupKey, projectsMap) ??
        {}
      );
  }
}

// Calculates task properties needed to satisfy view filter upon paste.
export function getFilterOverrides(filter?: string): TaskPlacement {
  switch (filter) {
    case "today":
      return dateBucketUpdates("today") ?? {};
    case "p1":
      return priorityBucketUpdates("critical") ?? {};
    default:
      return {};
  }
}

// Resolves paste destination from view project, filter, and cursor column (which takes precedence).
export function getPasteOverrides({
  projectId,
  filter,
  targetColumnTitle,
  projectsMap,
  groupBy,
}: {
  projectId?: string | null;
  filter?: string;
  targetColumnTitle?: string;
  projectsMap: Map<string, Project>;
  groupBy?: GroupOption;
}): TaskPlacement {
  const overrides: TaskPlacement = {};

  if (projectId === "inbox") {
    overrides.project_id = null;
  } else if (projectId && projectId !== "all") {
    overrides.project_id = projectId;
  }

  Object.assign(overrides, getFilterOverrides(filter));

  if (targetColumnTitle !== undefined) {
    Object.assign(
      overrides,
      getTaskUpdatesForGroup(targetColumnTitle, projectsMap, groupBy),
    );
  }

  return overrides;
}

// Bakes visible order into day_order when switching to custom sort.
export function computeFreezeOrderPairs(
  visibleTasks: Task[],
): { id: string; day_order: number }[] {
  const pairs: { id: string; day_order: number }[] = [];
  visibleTasks.forEach((t, i) => {
    if (t.day_order !== i) {
      pairs.push({ id: t.id, day_order: i });
    }
  });
  return pairs;
}

// Computes day_order changes for single-task drag within flat list.
export function computeReorderPairs(
  movedId: string,
  orderedIds: string[],
  flatTasks: Task[],
  isSameSection = false,
): { id: string; day_order: number }[] {
  if (isSameSection) {
    // Slot-value-swap preserves existing day_orders for same-section reorder.
    const orders = computeReorderOrders(
      orderedIds,
      flatTasks,
      (t) => t.day_order,
    );
    return orderedIds.map((id, i) => ({ id, day_order: orders[i] ?? i }));
  }
  return computeMoveOrders(
    movedId,
    orderedIds,
    flatTasks,
    (t) => t.day_order,
  ).map(({ id, order }) => ({ id, day_order: order }));
}
