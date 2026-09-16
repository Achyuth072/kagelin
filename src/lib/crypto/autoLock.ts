const LAST_ACTIVE_KEY = "kagelin-last-active";

export function recordActivity(): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    // Ignore storage errors (private browsing, quota).
  }
}

export function getIdleMs(): number {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return 0;
    return Date.now() - Number(raw);
  } catch {
    return 0;
  }
}

export function shouldAutoLockNow(
  autoLock: { enabled: boolean; minutes: number },
  wouldUnlock: boolean,
): boolean {
  return (
    wouldUnlock &&
    autoLock.enabled &&
    // Prevent non-positive values from locking immediately.
    getIdleMs() >= Math.max(1, autoLock.minutes) * 60_000
  );
}
