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
  // (single-list variant — see computeMoveOrders for the multi-section variant)
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

/**
 * Move-based reorder for lists that render as multiple sections (columns /
 * groups) over one shared, globally-ordered flat list.
 *
 * A drag moves exactly ONE item. Rather than swapping order values among all
 * of the section's members (which, on a cross-section move, redistributes
 * values across the source/destination boundary and corrupts other sections),
 * this models the drag as a single move within the flat list:
 *
 *   1. Locate the moved item's new flat position from its neighbors in the
 *      section's post-drop order (`orderedIds`). Items between the old and new
 *      flat positions shift by one slot.
 *   2. Reassign order values only inside that contiguous span, each item
 *      taking the value of the slot it moves into — the value set is
 *      preserved, so every other item's relative order is untouched.
 *
 * When the span's pre-drag values aren't strictly increasing (ties from the
 * all-zero default, or `items` given in a display order that diverges from
 * the order values — e.g. an alphabetical sort being converted to a custom
 * order by the drop), slot-value swapping is meaningless. We then renumber
 * the ENTIRE new flat order sequentially, baking the visible order in — a
 * one-time normalization; later drags take the cheap span path.
 *
 * Returns {id, order} pairs ONLY for items whose value actually changed.
 * An empty result means the drop needs no persistence at all.
 *
 * @param movedId     The single dragged item.
 * @param orderedIds  The moved item's section in its post-drop order
 *                    (must include movedId).
 * @param items       The authoritative flat list, pre-drag. Pass it sorted by
 *                    the order value when the display follows custom order;
 *                    pass it in display order when the drop should bake a
 *                    derived sort (date/priority/alphabetical) into the
 *                    custom order.
 * @param orderOf     Reads the order value (day_order / sort_order) off an item.
 */
export function computeMoveOrders<T extends { id: string }>(
  movedId: string,
  orderedIds: string[],
  items: T[],
  orderOf: (item: T) => number,
): { id: string; order: number }[] {
  const movedIdx = orderedIds.indexOf(movedId);
  const moved = items.find((it) => it.id === movedId);
  if (movedIdx === -1 || !moved) return [];

  const inItems = new Set(items.map((it) => it.id));

  // Nearest section neighbors that exist in the flat list (skips fresh
  // optimistic items that the pre-drag snapshot doesn't know about).
  let prevId: string | undefined;
  for (let i = movedIdx - 1; i >= 0; i--) {
    if (inItems.has(orderedIds[i])) {
      prevId = orderedIds[i];
      break;
    }
  }
  let nextId: string | undefined;
  for (let i = movedIdx + 1; i < orderedIds.length; i++) {
    if (inItems.has(orderedIds[i])) {
      nextId = orderedIds[i];
      break;
    }
  }

  // Rebuild the flat list with the moved item re-inserted next to its new
  // section neighbors. With no neighbors (dropped into an empty section) the
  // flat position is unconstrained — keep it where it was.
  const without = items.filter((it) => it.id !== movedId);
  let insertIdx: number;
  if (prevId !== undefined) {
    insertIdx = without.findIndex((it) => it.id === prevId) + 1;
  } else if (nextId !== undefined) {
    insertIdx = without.findIndex((it) => it.id === nextId);
  } else {
    return [];
  }
  const newFlat = [
    ...without.slice(0, insertIdx),
    moved,
    ...without.slice(insertIdx),
  ];

  // The contiguous span of slots whose occupant changed.
  let first = 0;
  while (first < items.length && newFlat[first].id === items[first].id) {
    first++;
  }
  if (first === items.length) return [];
  let last = items.length - 1;
  while (last >= 0 && newFlat[last].id === items[last].id) {
    last--;
  }

  const slotOrders: number[] = [];
  for (let i = first; i <= last; i++) {
    slotOrders.push(orderOf(items[i]));
  }
  let isStrictlyIncreasing = true;
  for (let i = 1; i < slotOrders.length; i++) {
    if (slotOrders[i] <= slotOrders[i - 1]) {
      isStrictlyIncreasing = false;
      break;
    }
  }

  if (isStrictlyIncreasing) {
    const pairs: { id: string; order: number }[] = [];
    for (let i = first; i <= last; i++) {
      pairs.push({ id: newFlat[i].id, order: slotOrders[i - first] });
    }
    return pairs;
  }

  // Ties or non-monotonic values: bake the whole new flat order.
  const pairs: { id: string; order: number }[] = [];
  newFlat.forEach((it, i) => {
    if (orderOf(it) !== i) {
      pairs.push({ id: it.id, order: i });
    }
  });
  return pairs;
}
