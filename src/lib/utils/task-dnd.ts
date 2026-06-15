import { addDays, format } from "date-fns";
import type { Task, Project } from "@/lib/types/task";
import { computeReorderOrders } from "@/lib/utils/reorder";

/**
 * Calculates the properties to update when a task is moved to a specific group/column.
 */
export function getTaskUpdatesForGroup(
  groupTitle: string,
  projectsMap: Map<string, Project>,
): Partial<Task> {
  let updates: Partial<Task> = {};
  const today = new Date();
  const groupKey = groupTitle.toLowerCase();

  if (groupKey === "today") {
    const d = format(today, "yyyy-MM-dd");
    updates = { do_date: d, due_date: d };
  } else if (groupKey === "tomorrow") {
    const d = format(addDays(today, 1), "yyyy-MM-dd");
    updates = { do_date: d, due_date: d };
  } else if (groupKey === "upcoming") {
    const d = format(addDays(today, 2), "yyyy-MM-dd");
    updates = { do_date: d, due_date: d };
  } else if (groupKey === "overdue") {
    updates = {};
  } else if (groupKey === "no date") {
    updates = { do_date: null, due_date: null };
  } else if (groupKey === "this evening") {
    updates = { is_evening: true };
  } else if (groupKey === "active" || groupKey === "tasks") {
    updates = { is_evening: false };
  } else if (groupKey === "critical") {
    updates = { priority: 1 };
  } else if (groupKey === "high") {
    updates = { priority: 2 };
  } else if (groupKey === "medium") {
    updates = { priority: 3 };
  } else if (groupKey === "low") {
    updates = { priority: 4 };
  } else if (groupKey === "inbox") {
    updates = { project_id: null };
  } else {
    // Find project by name in the map
    for (const p of projectsMap.values()) {
      if (p.name.toLowerCase() === groupKey) {
        updates = { project_id: p.id };
        break;
      }
    }
  }
  return updates;
}

/**
 * Computes {id, day_order} pairs for a reorder operation. Thin wrapper over the
 * shared slot-value-swap core (see computeReorderOrders): each task in the new
 * order takes the day_order of the slot it moves into, keeping the global flat
 * cache stable across sections/groups and preventing cross-section interleaving.
 *
 * @param orderedIds  Task IDs in the desired new order (one section/group only).
 * @param flatTasks   The server-authoritative flat task list (pre-drag).
 *                    In list view this is the raw tasks from useTasks.
 *                    In board view this is captured at handleDragStart.
 */
export function computeReorderPairs(
  orderedIds: string[],
  flatTasks: Task[],
): { id: string; day_order: number }[] {
  const orders = computeReorderOrders(
    orderedIds,
    flatTasks,
    (t) => t.day_order,
  );
  return orderedIds.map((id, i) => ({ id, day_order: orders[i] }));
}
