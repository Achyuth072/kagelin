import { get, set, del } from "idb-keyval";

const MASTER_KEY_STORAGE_KEY = "kagelin-master-key";

interface StoredMasterKey {
  userId: string;
  key: Uint8Array;
}

export interface KeyStore {
  load(userId?: string): Promise<Uint8Array | null>;
  save(userId: string, key: Uint8Array): Promise<void>;
  clear(): Promise<void>;
}

// undefined: not yet loaded; null: no key stored.
let cached: StoredMasterKey | null | undefined;

function isStoredMasterKey(value: unknown): value is StoredMasterKey {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StoredMasterKey).userId === "string" &&
    (value as StoredMasterKey).key instanceof Uint8Array
  );
}

export const keyStore: KeyStore = {
  async load(userId) {
    if (cached === undefined) {
      const stored = await get<unknown>(MASTER_KEY_STORAGE_KEY);
      // Discard legacy unowned keys.
      cached = isStoredMasterKey(stored) ? stored : null;
      if (stored !== undefined && cached === null) {
        await del(MASTER_KEY_STORAGE_KEY);
      }
    }
    if (!cached) return null;
    // Evict cached key on user mismatch to prevent cross-account exposure.
    if (userId !== undefined && cached.userId !== userId) {
      await keyStore.clear();
      return null;
    }
    return cached.key;
  },
  async save(userId, key) {
    const record: StoredMasterKey = { userId, key };
    await set(MASTER_KEY_STORAGE_KEY, record);
    cached = record;
  },
  async clear() {
    await del(MASTER_KEY_STORAGE_KEY);
    cached = null;
  },
};
