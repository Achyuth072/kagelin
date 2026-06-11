import type { Habit } from "@/lib/types/habit";

/**
 * Computes {id, sort_order} pairs for a habit reorder using slot-value-swap.
 *
 * Parallel to task-dnd's computeReorderPairs, but habits are a single flat list
 * (no sections/groups), so there is no cross-section slot-swap complexity — just
 * the monotonic-vs-slot-index fallback that guards against snap-back.
 *
 * Each habit in the new order takes the sort_order value from the slot it is
 * moving INTO (its original relative position), keeping the set of sort_order
 * values stable so the DB sort reproduces the optimistic order. When the slot
 * values are tied (e.g. all 0 from the column default), they can't be
 * distinguished after a refetch, so we fall back to slot indices instead.
 *
 * @param orderedIds  Habit IDs in the desired new order.
 * @param habits      The server-authoritative flat habit list (pre-drag).
 */
export function computeReorderPairs(
  orderedIds: string[],
  habits: Habit[],
): { id: string; sort_order: number }[] {
  const reorderedIdSet = new Set(orderedIds);

  // Collect the flat-array positions occupied by the reordered habits.
  const slots: number[] = [];
  for (let i = 0; i < habits.length; i++) {
    if (reorderedIdSet.has(habits[i].id)) {
      slots.push(i);
    }
  }

  // Pre-drag sort_order values at each slot position.
  const slotSortOrders = slots.map((slotIdx) => habits[slotIdx].sort_order);

  // If the slot values aren't strictly increasing (ties / all-zero default),
  // swapping produces duplicates the DB can't order, causing snap-back. Use the
  // slot indices instead — they are always unique and ascending.
  let isStrictlyIncreasing = true;
  for (let i = 1; i < slotSortOrders.length; i++) {
    if (slotSortOrders[i] <= slotSortOrders[i - 1]) {
      isStrictlyIncreasing = false;
      break;
    }
  }

  const effectiveSortOrders = isStrictlyIncreasing ? slotSortOrders : slots;

  // Map each habit in the new order to the sort_order of the slot it moves into.
  // An id absent from the flat list (e.g. a fresh optimistic habit) falls back
  // to its sequential index to avoid gaps.
  return orderedIds.map((id, i) => ({
    id,
    sort_order: effectiveSortOrders[i] ?? i,
  }));
}
