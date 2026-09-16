import { get, set, del } from "idb-keyval";
import type { GuestData } from "@/lib/mock/mock-store";
import { hasUserId } from "@/lib/storage/userScoped";

const SNAPSHOT_KEY = "kanso-guest-migration-snapshot";

interface StoredSnapshot {
  userId: string;
  data: GuestData;
}

function isStoredSnapshot(value: unknown): value is StoredSnapshot {
  return hasUserId(value) && typeof (value as StoredSnapshot).data === "object";
}

// Scoped to the creating account to prevent stranded snapshots from importing into other accounts.
export const migrationSnapshot = {
  async load(userId: string): Promise<GuestData | null> {
    const stored = await get<unknown>(SNAPSHOT_KEY);
    if (stored === undefined) return null;
    if (!isStoredSnapshot(stored) || stored.userId !== userId) {
      await del(SNAPSHOT_KEY);
      return null;
    }
    return stored.data;
  },
  async save(userId: string, data: GuestData): Promise<void> {
    await set(SNAPSHOT_KEY, { userId, data } satisfies StoredSnapshot);
  },
  async clear(): Promise<void> {
    await del(SNAPSHOT_KEY);
  },
};
