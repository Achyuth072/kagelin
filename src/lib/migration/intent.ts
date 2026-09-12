const INTENT_KEY = "kanso_guest_migration_intent";

// Binds guest data migration to the account active when transitioning to prevent cross-account imports on shared devices.
export const migrationIntent = {
  record(userId: string): void {
    localStorage.setItem(INTENT_KEY, userId);
  },
  isFor(userId: string): boolean {
    return localStorage.getItem(INTENT_KEY) === userId;
  },
  clear(): void {
    localStorage.removeItem(INTENT_KEY);
  },
};
