/**
 * Shared slot-value-swap reorder core for drag-to-reorder lists.
 *
 * Both tasks (`day_order`) and habits (`sort_order`) persist a user-defined
 * order in a numeric column. After a drag, each item in the new order takes the
 * order value of the slot it is moving INTO — keeping the set of values stable
 * so the server's sort reproduces the optimistic order rather than snapping back.
 *
 * When the slot values aren't strictly increasing (ties / all-zero default),
 * swapping produces duplicates the server can't distinguish, so we fall back to
 * the slot indices, which are always unique and ascending.
 *
 * Returns a parallel array of effective order values aligned to `orderedIds`.
 *
 * @param orderedIds  Item IDs in the desired new order.
 * @param items       The server-authoritative flat list (pre-drag).
 * @param orderOf     Reads the order value (day_order / sort_order) off an item.
 */
export function computeReorderOrders<T extends { id: string }>(
  orderedIds: string[],
  items: T[],
  orderOf: (item: T) => number,
): number[] {
  const reorderedIdSet = new Set(orderedIds);

  // Flat-array positions occupied by the reordered items, in original sequence.
  const slots: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (reorderedIdSet.has(items[i].id)) {
      slots.push(i);
    }
  }

  // Pre-drag order values at each slot position.
  const slotOrders = slots.map((slotIdx) => orderOf(items[slotIdx]));

  let isStrictlyIncreasing = true;
  for (let i = 1; i < slotOrders.length; i++) {
    if (slotOrders[i] <= slotOrders[i - 1]) {
      isStrictlyIncreasing = false;
      break;
    }
  }

  const effectiveOrders = isStrictlyIncreasing ? slotOrders : slots;

  // An id absent from the flat list (e.g. a fresh optimistic item) falls back to
  // its sequential index to avoid gaps.
  return orderedIds.map((_, i) => effectiveOrders[i] ?? i);
}
