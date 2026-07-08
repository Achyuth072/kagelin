/**
 * One-shot localStorage cleanups, run every session at app start (see
 * `AppShell`) so they reach every user regardless of which pages they visit.
 */

/** Key the pre-beta CalDAV connect flow stored credentials under. */
export const CALDAV_STORAGE_KEY = "kanso_caldav_credentials";

/**
 * C-2: a pre-beta CalDAV connect flow wrote server URL + username + password
 * to localStorage in plaintext. The flow is gone (see ConnectCalendarDialog
 * history); purge anything it left behind.
 */
export function purgeLegacyStorage(): void {
  localStorage.removeItem(CALDAV_STORAGE_KEY);
}
