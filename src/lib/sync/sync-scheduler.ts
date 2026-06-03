/**
 * Cross-trigger sync coordination for the calendar.
 *
 * - Auto-sync throttle: mount and window-refocus share one timestamp so they
 *   don't both fire a full pull within the throttle window (~5 min).
 * - Local-edit signal: mutations notify here; the calendar sync hook debounces
 *   these into a push-only flush (~4 s after the last edit).
 *
 * Module-level state intentionally outlives component remounts within a session.
 */

// Short throttle: dedupes the focus+visibilitychange double-fire and rapid
// tab-flapping, but a deliberate return to the app still pulls fresh. Incremental
// sync is a cheap delta call, so this can be tight. (Periodic idle polling is the
// premium background-sync tier — Phase 61 — and intentionally not done here.)
const AUTO_SYNC_THROTTLE_MS = 30 * 1000;

let lastAutoSyncAt = 0;

/** True if enough time has elapsed since the last auto (mount/refocus) sync. */
export function canAutoSync(throttleMs: number = AUTO_SYNC_THROTTLE_MS): boolean {
  return Date.now() - lastAutoSyncAt > throttleMs;
}

/** Stamp the auto-sync clock; call right before an auto full sync runs. */
export function markAutoSync(): void {
  lastAutoSyncAt = Date.now();
}

type EditListener = () => void;
const editListeners = new Set<EditListener>();

/** Fire from a calendar mutation's onSuccess to schedule a debounced push. */
export function notifyLocalEdit(): void {
  editListeners.forEach((listener) => listener());
}

/** Subscribe to local-edit signals. Returns an unsubscribe fn. */
export function onLocalEdit(listener: EditListener): () => void {
  editListeners.add(listener);
  return () => editListeners.delete(listener);
}
