export const SWIPE_HINT_STORAGE_KEY = "kanso_swipe_hint_dismissed";

export function isSwipeHintDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage?.getItem(SWIPE_HINT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function dismissSwipeHint(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(SWIPE_HINT_STORAGE_KEY, "true");
  } catch {
    // Ignore storage quota or restricted access errors
  }
}
