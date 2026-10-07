import {
  runReseal,
  type ResealProgress,
  type ResealResult,
  type UnreadableValue,
} from "@/lib/crypto/reseal";
import { markResealComplete } from "@/lib/crypto/keyManager";
import { keyStore } from "@/lib/crypto/keyStore";

// Only a pass that finds nothing to write proves the Account clean, so a pass that
// writes needs one more; the rest absorb concurrent edits from another device.
const MAX_PASSES = 4;

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

// The signal stops a run a newer one replaced (a rotation) between batches; rows already in
// flight still finish, and any conflict they cause is retried by the newer run. Once aborted,
// the abort is what the caller gets, since the newer run reports the real outcome.
export async function resealUntilClean(
  userId: string,
  onProgress: (progress: ResealProgress) => void,
  signal: AbortSignal,
): Promise<void> {
  const ring = await keyStore.loadKeyring(userId);
  if (!ring) throw new Error("The content key is unavailable.");
  let lastError: unknown;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    signal.throwIfAborted();
    let result: ResealResult;
    try {
      result = await runReseal(userId, onProgress, signal);
    } catch (err) {
      signal.throwIfAborted();
      lastError = err;
      continue;
    }
    signal.throwIfAborted();
    lastError = undefined;
    if (result.sealed > 0) continue;
    if (result.unreadable.length > 0) {
      throw new UnreadableContentError(result.unreadable);
    }
    if (!(await markResealComplete(userId, ring.keyId))) {
      throw new Error("The content key changed during the Re-seal.");
    }
    return;
  }
  throw lastError ?? new Error("Some content still needs upgrading.");
}
