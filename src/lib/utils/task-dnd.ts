import { addDays, format } from "date-fns";
import type { Task, Project } from "@/lib/types/task";
import type { GroupOption } from "@/lib/types/sorting";
import { computeMoveOrders, computeReorderOrders } from "@/lib/utils/reorder";

/**
 * Group titles that are derived buckets with no settable property behind them.
 * "Overdue" means "dated before today" — a drop can't make that true without
 * silently back-dating the task, so cross-group drags must not enter it.
 * (Reordering WITHIN the group is still fine.)
 */
export function isDropBlockedGroup(
  groupTitle: string,
  groupBy?: GroupOption,
): boolean {
  if (groupBy !== undefined && groupBy !== "date") return false;
  return groupTitle.toLowerCase() === "overdue";
}

const dateBucketUpdates = (groupKey: string): Partial<Task> | null => {
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
  // "overdue" — derived, non-settable (see isDropBlockedGroup)
  return null;
};

const priorityBucketUpdates = (groupKey: string): Partial<Task> | null => {
  const priorities: Record<string, 1 | 2 | 3 | 4> = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  };
  return groupKey in priorities ? { priority: priorities[groupKey] } : null;
};

const projectBucketUpdates = (
  groupKey: string,
  projectsMap: Map<string, Project>,
): Partial<Task> | null => {
  if (groupKey === "inbox") return { project_id: null };
  for (const p of projectsMap.values()) {
    if (p.name.toLowerCase() === groupKey) {
      return { project_id: p.id };
    }
  }
  return null;
};

const eveningBucketUpdates = (groupKey: string): Partial<Task> | null => {
  if (groupKey === "this evening") return { is_evening: true };
  if (groupKey === "active" || groupKey === "tasks") {
    return { is_evening: false };
  }
  return null;
};

/**
 * Calculates the properties to update when a task is moved to a specific
 * group/column. When `groupBy` is provided, the title is interpreted strictly
 * under that grouping mode — so a project literally named "Today" maps to its
 * project, not to a date change. Without `groupBy` the legacy heuristic
 * (date → evening → priority → project) is used.
 */
export function getTaskUpdatesForGroup(
  groupTitle: string,
  projectsMap: Map<string, Project>,
  groupBy?: GroupOption,
): Partial<Task> {
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

/**
 * Computes {id, day_order} pairs for a single-task drag. Thin wrapper over
 * computeMoveOrders (see reorder.ts): the drag is modeled as one task moving
 * within the shared flat list, so only the slots between its old and new flat
 * positions are reassigned — other sections/groups keep their day_orders and
 * cannot be rearranged by the drop.
 *
 * Returns [] when the drop changes nothing persistent (e.g. dropped back in
 * place, or into an empty column where only the property update matters) —
 * callers should skip the reorder mutation entirely in that case.
 *
 * @param movedId     The dragged task.
 * @param orderedIds  The final section's task IDs in post-drop order.
 * @param flatTasks   The authoritative flat task list (pre-drag). Sorted by
 *                    day_order when sortBy is "custom"; in display order when
 *                    a derived sort is being converted to custom by the drop.
 */
/**
 * Computes {id, day_order} pairs that bake a currently-visible order into
 * day_order, omitting entries that already match. Used when sortBy switches
 * to "custom" from a derived sort via the sort menu (not a drag): the list
 * must freeze in place rather than jump to whatever day_order previously
 * held from before the derived sort was applied.
 */
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

export function computeReorderPairs(
  movedId: string,
  orderedIds: string[],
  flatTasks: Task[],
  isSameSection = false,
): { id: string; day_order: number }[] {
  if (isSameSection) {
    // Within a single section the slot-value-swap preserves the section's
    // existing day_order set, which is exactly what we want for a same-section
    // reorder. computeMoveOrders would instead model this as one task moving
    // within the flat list and can return an empty/no-op result when the
    // neighbors happen to line up.
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
