import {
  findPendingQueueRows,
  findPendingRows,
  runReseal,
  type ResealProgress,
  type UnreadableValue,
} from "@/lib/crypto/reseal";
import { markResealComplete } from "@/lib/crypto/keyManager";
import { keyStore } from "@/lib/crypto/keyStore";

// A concurrent edit on another device fails one pass; the next pass picks it up.
const MAX_PASSES = 3;

// Retrying cannot open these, so the retired key stays until each one is fixed or deleted.
export class UnreadableContentError extends Error {
  constructor(readonly values: UnreadableValue[]) {
    super(
      `Cannot re-seal ${values
        .map(({ table, column, id }) => `${table}.${column} of row ${id}`)
        .join(", ")}: the value cannot be opened.`,
    );
  }
}

export async function resealUntilClean(
  userId: string,
  onProgress: (progress: ResealProgress) => void,
): Promise<void> {
  const ring = await keyStore.loadKeyring(userId);
  if (!ring) throw new Error("The content key is unavailable.");
  let lastError: unknown;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let unreadable: UnreadableValue[];
    try {
      unreadable = await runReseal(userId, onProgress);
    } catch (err) {
      lastError = err;
      continue;
    }
    const isUnreadable = (row: { table: string; id: string }) =>
      unreadable.some((v) => v.table === row.table && v.id === row.id);
    const pending =
      (await findPendingRows(userId)).filter((row) => !isUnreadable(row))
        .length + (await findPendingQueueRows(userId, ring.keyId)).length;
    if (pending > 0) continue;
    if (unreadable.length > 0) throw new UnreadableContentError(unreadable);
    await markResealComplete(userId, ring.keyId);
    return;
  }
  throw lastError ?? new Error("Some content still needs upgrading.");
}
