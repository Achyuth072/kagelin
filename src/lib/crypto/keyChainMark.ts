import { get, update } from "idb-keyval";
import type { EncryptionKeyRow } from "@/lib/crypto/encryptionKeyRowCache";
import { currentKeyIdOf } from "@/lib/crypto/keyring";

// Monotonic watermark; prevents the server from rolling back the key chain.
export interface KeyChainMark {
  keyId: number;
  sealedV2: boolean;
  // Rotations strictly increment key ID; retired keys <= this ID are replayed.
  retiredClearedAt: number;
}

const STORAGE_KEY_PREFIX = "kagelin-key-chain-mark:";
const NOTHING_SEEN: KeyChainMark = {
  keyId: 0,
  sealedV2: false,
  retiredClearedAt: 0,
};

async function load(userId: string): Promise<KeyChainMark> {
  return {
    ...NOTHING_SEEN,
    ...(await get<Partial<KeyChainMark>>(STORAGE_KEY_PREFIX + userId)),
  };
}

// Read-modify-write so concurrent tabs cannot lower the mark.
async function raise(
  userId: string,
  row: Pick<
    EncryptionKeyRow,
    "current_key_id" | "sealed_v2_at" | "retired_keys"
  >,
): Promise<void> {
  const keyId = Number(currentKeyIdOf(row));
  const cleared =
    !!row.retired_keys && Object.keys(row.retired_keys).length === 0;
  await update<Partial<KeyChainMark>>(STORAGE_KEY_PREFIX + userId, (seen) => ({
    keyId: Math.max(seen?.keyId ?? 0, keyId),
    sealedV2: !!seen?.sealedV2 || !!row.sealed_v2_at,
    retiredClearedAt: Math.max(
      seen?.retiredClearedAt ?? 0,
      cleared ? keyId : 0,
    ),
  }));
}

export const keyChainMark = { load, raise };
