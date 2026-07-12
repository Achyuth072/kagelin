/**
 * One-shot localStorage cleanups, run every session at app start (see
 * `AppShell`) so they reach every user regardless of which pages they visit.
 */

/** Key the pre-beta CalDAV connect flow stored credentials under. */
export const CALDAV_STORAGE_KEY = "kanso_caldav_credentials";

/** Key the pre-beta WebDAV sync form stored credentials under. */
export const WEBDAV_STORAGE_KEY = "kanso_webdav_credentials";

/**
 * Pre-beta CalDAV and WebDAV flows both wrote server URL + username +
 * password to localStorage in plaintext. Neither writes it anymore (see
 * ConnectCalendarDialog and BackupSyncSettings history); purge anything they
 * left behind.
 */
export function purgeLegacyStorage(): void {
  localStorage.removeItem(CALDAV_STORAGE_KEY);
  localStorage.removeItem(WEBDAV_STORAGE_KEY);
}
