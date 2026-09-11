import { get, set, del } from "idb-keyval";
import type { GuestData } from "@/lib/mock/mock-store";

const SNAPSHOT_KEY = "kanso-guest-migration-snapshot";

export const migrationSnapshot = {
  async load(): Promise<GuestData | null> {
    const value = await get<GuestData>(SNAPSHOT_KEY);
    return value ?? null;
  },
  async save(data: GuestData): Promise<void> {
    await set(SNAPSHOT_KEY, data);
  },
  async clear(): Promise<void> {
    await del(SNAPSHOT_KEY);
  },
};
