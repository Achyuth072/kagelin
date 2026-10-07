import { get, set, del } from "idb-keyval";
import { hasUserId } from "@/lib/storage/userScoped";
import { INITIAL_KEY_ID } from "@/lib/crypto/envelope";

const MASTER_KEY_STORAGE_KEY = "kagelin-master-key";

// Reads select a key by the envelope's key id; writes always use the current one.
export interface Keyring {
  keyId: string;
  key: Uint8Array;
  retired: Record<string, Uint8Array>;
}

interface StoredMasterKey {
  userId: string;
  key: Uint8Array;
  // Absent on records saved before rotation existed.
  keyId?: string;
  retired?: Record<string, Uint8Array>;
}

export interface KeyStore {
  load(userId?: string): Promise<Uint8Array | null>;
  loadKeyring(userId?: string): Promise<Keyring | null>;
  loadUserId(): Promise<string | null>;
  save(
    userId: string,
    key: Uint8Array,
    keyId?: string,
    retired?: Record<string, Uint8Array>,
  ): Promise<void>;
  clear(): Promise<void>;
}

// undefined: not yet loaded; null: no key stored.
let cached: StoredMasterKey | null | undefined;

function isStoredMasterKey(value: unknown): value is StoredMasterKey {
  return (
    hasUserId(value) && (value as StoredMasterKey).key instanceof Uint8Array
  );
}

async function loadRecord(): Promise<StoredMasterKey | null> {
  if (cached === undefined) {
    const stored = await get<unknown>(MASTER_KEY_STORAGE_KEY);
    // Discard legacy unowned keys.
    cached = isStoredMasterKey(stored) ? stored : null;
    if (stored !== undefined && cached === null) {
      await del(MASTER_KEY_STORAGE_KEY);
    }
  }
  return cached;
}

async function loadOwnedRecord(
  userId?: string,
): Promise<StoredMasterKey | null> {
  const record = await loadRecord();
  if (!record) return null;
  // Evict cached key on user mismatch to prevent cross-account exposure.
  if (userId !== undefined && record.userId !== userId) {
    await keyStore.clear();
    return null;
  }
  return record;
}

export const keyStore: KeyStore = {
  async load(userId) {
    return (await loadOwnedRecord(userId))?.key ?? null;
  },
  async loadKeyring(userId) {
    const record = await loadOwnedRecord(userId);
    if (!record) return null;
    return {
      keyId: record.keyId ?? INITIAL_KEY_ID,
      key: record.key,
      retired: record.retired ?? {},
    };
  },
  // The service worker has no session; the key's owner is the user its notifications were sealed for.
  async loadUserId() {
    return (await loadRecord())?.userId ?? null;
  },
  async save(userId, key, keyId = INITIAL_KEY_ID, retired = {}) {
    const record: StoredMasterKey = { userId, key, keyId, retired };
    await set(MASTER_KEY_STORAGE_KEY, record);
    cached = record;
  },
  async clear() {
    await del(MASTER_KEY_STORAGE_KEY);
    cached = null;
  },
};
