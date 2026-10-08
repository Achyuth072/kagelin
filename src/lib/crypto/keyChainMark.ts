import { get, update } from "idb-keyval";
import type { EncryptionKeyRow } from "@/lib/crypto/encryptionKeyRowCache";
import { currentKeyIdOf } from "@/lib/crypto/keyring";

// Monotonic watermark; prevents the server from rolling back the key chain.
export interface KeyChainMark {
  keyId: number;
  sealedV2: boolean;
}

const STORAGE_KEY_PREFIX = "kagelin-key-chain-mark:";
const NOTHING_SEEN: KeyChainMark = { keyId: 0, sealedV2: false };

async function load(userId: string): Promise<KeyChainMark> {
  return (await get<KeyChainMark>(STORAGE_KEY_PREFIX + userId)) ?? NOTHING_SEEN;
}

// Read-modify-write so concurrent tabs cannot lower the mark.
async function raise(
  userId: string,
  row: Pick<EncryptionKeyRow, "current_key_id" | "sealed_v2_at">,
): Promise<void> {
  await update<KeyChainMark>(STORAGE_KEY_PREFIX + userId, (seen) => ({
    keyId: Math.max(seen?.keyId ?? 0, Number(currentKeyIdOf(row))),
    sealedV2: !!seen?.sealedV2 || !!row.sealed_v2_at,
  }));
}

export const keyChainMark = { load, raise };
