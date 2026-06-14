import type { Habit } from "@/lib/types/habit";
import { computeReorderOrders } from "@/lib/utils/reorder";

/**
 * Computes {id, sort_order} pairs for a habit reorder. Thin wrapper over the
 * shared slot-value-swap core (see computeReorderOrders); habits are a single
 * flat list, so there is no cross-section complexity to add here.
 *
 * @param orderedIds  Habit IDs in the desired new order.
 * @param habits      The server-authoritative flat habit list (pre-drag).
 */
export function computeReorderPairs(
  orderedIds: string[],
  habits: Habit[],
): { id: string; sort_order: number }[] {
  const orders = computeReorderOrders(orderedIds, habits, (h) => h.sort_order);
  return orderedIds.map((id, i) => ({ id, sort_order: orders[i] }));
}
