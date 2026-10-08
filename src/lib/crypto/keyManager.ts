import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_ARGON2_PARAMS,
  base64ToBytes,
  bytesToBase64,
  deriveKeyFromPassphrase,
  generateMasterKey,
  generateRecoveryCode,
  generateSalt,
  normalizeRecoveryCode,
  rotationToken,
  rotationVerifier,
  unwrapMasterKey,
  wrapMasterKey,
} from "@/lib/crypto/masterKey";
import { keyStore } from "@/lib/crypto/keyStore";
import {
  encryptionKeyRowCache,
  type EncryptionKeyRow,
} from "@/lib/crypto/encryptionKeyRowCache";
import { findPendingRows } from "@/lib/crypto/reseal";
import { recordActivity } from "@/lib/crypto/autoLock";
import { currentKeyIdOf } from "@/lib/crypto/keyring";
import { keyChainMark } from "@/lib/crypto/keyChainMark";

export class UnlockError extends Error {}

const KEY_CHANGED_ELSEWHERE =
  "Your content key was changed on another device. Unlock again with your new passphrase.";

async function rememberKeyRow(
  userId: string,
  row: EncryptionKeyRow,
): Promise<void> {
  await encryptionKeyRowCache.save(userId, row);
  // Only raised once unlocked so an untrusted row cannot lock out the device.
  await keyChainMark.raise(userId, { sealed_v2_at: row.sealed_v2_at });
}

async function cacheMasterKey(
  userId: string,
  masterKey: Uint8Array,
  row: Pick<EncryptionKeyRow, "current_key_id" | "retired_keys">,
): Promise<void> {
  const keyId = Number(currentKeyIdOf(row));
  const mark = await keyChainMark.load(userId);
  // Prevent server rollback to a retired key.
  if (keyId < mark.keyId) {
    throw new UnlockError(
      "This device has seen a newer content key than the server sent. Try again later.",
    );
  }
  let retiredKeys = row.retired_keys ?? {};
  // Dropped rather than rejected to prevent lockouts; resealed data needs no retired keys.
  if (keyId <= mark.retiredClearedAt && Object.keys(retiredKeys).length > 0) {
    Sentry.captureException(
      new Error("Ignored retired keys written back after they were cleared"),
    );
    retiredKeys = {};
  }
  const retired = Object.fromEntries(
    await Promise.all(
      Object.entries(retiredKeys).map(
        async ([id, wrapped]) =>
          [id, await unwrapMasterKey(wrapped, masterKey)] as const,
      ),
    ),
  );
  await keyChainMark.raise(userId, {
    current_key_id: row.current_key_id,
    retired_keys: retiredKeys,
  });
  await keyStore.save(userId, masterKey, currentKeyIdOf(row), retired);
  recordActivity();
}

// Backfill verifier for accounts created before rotation proof existed.
async function ensureRotationVerifier(
  userId: string,
  masterKey: Uint8Array,
  row: EncryptionKeyRow,
): Promise<void> {
  if (!row.rotation_verifier) {
    return backfillRotationVerifier(userId, masterKey, currentKeyIdOf(row));
  }
  // Only a session without the key could have set it; key-row changes now fail until support clears it.
  if (row.rotation_verifier !== (await rotationVerifier(masterKey))) {
    throw new Error(
      "Your account's proof of the content key doesn't match this key. Contact support.",
    );
  }
}

// A no-op once any verifier is stored, and on a row under another key.
async function backfillRotationVerifier(
  userId: string,
  masterKey: Uint8Array,
  keyId: string,
): Promise<void> {
  const { error } = await createClient()
    .from("encryption_keys")
    .update({ rotation_verifier: await rotationVerifier(masterKey) })
    .eq("user_id", userId)
    .eq("current_key_id", Number(keyId))
    .is("rotation_verifier", null);
  if (error) throw error;
}

function ensureRotationVerifierInBackground(
  userId: string,
  masterKey: Uint8Array,
  row: EncryptionKeyRow,
): void {
  ensureRotationVerifier(userId, masterKey, row).catch((err) =>
    Sentry.captureException(err),
  );
}

async function unwrapOrThrow(
  wrapped: string,
  derivedKey: Uint8Array,
  wrongCredentialMessage: string,
): Promise<Uint8Array> {
  try {
    return await unwrapMasterKey(wrapped, derivedKey);
  } catch {
    throw new UnlockError(wrongCredentialMessage);
  }
}

// Proof of the key keeps a session without it from replacing the wrappers. Guarded on the
// key the caller holds: a device that missed a rotation must not write a wrapper of the
// retired key into a row that now names the new one, so null means a rotation overtook it.
async function proveAndUpdateKeyRow(
  userId: string,
  masterKey: Uint8Array,
  keyId: string,
  patch: Record<string, unknown>,
): Promise<EncryptionKeyRow | null> {
  await backfillRotationVerifier(userId, masterKey, keyId);
  const { data, error } = await createClient().rpc(
    "update_encryption_key_row",
    {
      p_expected_key_id: Number(keyId),
      p_rotation_token: await rotationToken(masterKey),
      p_patch: patch,
    },
  );
  if (error) throw error;
  const row = (data as EncryptionKeyRow[] | null)?.[0] ?? null;
  if (row) await rememberKeyRow(userId, row);
  return row;
}

async function updateEncryptionKeyRow(
  userId: string,
  masterKey: Uint8Array,
  keyId: string,
  patch: Record<string, unknown>,
): Promise<EncryptionKeyRow> {
  const row = await proveAndUpdateKeyRow(userId, masterKey, keyId, patch);
  if (!row) {
    throw new UnlockError(KEY_CHANGED_ELSEWHERE);
  }
  return row;
}

async function flagPassphraseReset(
  userId: string,
  keyId: string,
): Promise<void> {
  const { data, error } = await createClient()
    .from("encryption_keys")
    .update({ passphrase_reset_required: true })
    .eq("user_id", userId)
    .eq("current_key_id", Number(keyId))
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new UnlockError(KEY_CHANGED_ELSEWHERE);
  }
  await rememberKeyRow(userId, data as EncryptionKeyRow);
}

async function fetchEncryptionKeyRow(
  userId: string,
): Promise<EncryptionKeyRow | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("encryption_keys")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    const row = (data as EncryptionKeyRow | null) ?? null;
    if (row) await rememberKeyRow(userId, row);
    return row;
  } catch (err) {
    const cached = await encryptionKeyRowCache.load(userId);
    if (cached) return cached;
    throw err;
  }
}

export async function hasEncryptionKey(userId: string): Promise<boolean> {
  return (await fetchEncryptionKeyRow(userId)) !== null;
}

export async function getEncryptionKeyRow(
  userId: string,
): Promise<EncryptionKeyRow | null> {
  return fetchEncryptionKeyRow(userId);
}

// Leaves sealed_v2_at unset so re-sealing keeps reporting unopenable values.
export async function markMigrationComplete(
  userId: string,
  allSealed: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const ring = await keyStore.loadKeyring(userId);
  if (!ring) throw new UnlockError("Unlock before finishing encryption.");
  await updateEncryptionKeyRow(userId, ring.key, ring.keyId, {
    migrated_at: now,
    ...(allSealed && { sealed_v2_at: now }),
  });
}

// After this the server rejects `-v1` writes for the Account, and retired keys are gone.
// Guarded on the key id the pass ran under: a rotation since then still needs those keys,
// so false means nothing was marked.
export async function markResealComplete(
  userId: string,
  keyId: string,
): Promise<boolean> {
  const ring = await keyStore.loadKeyring(userId);
  if (!ring) throw new UnlockError("Unlock before finishing the Re-seal.");
  if (ring.keyId !== keyId) return false;
  const row = await proveAndUpdateKeyRow(userId, ring.key, keyId, {
    sealed_v2_at: new Date().toISOString(),
    retired_keys: {},
  });
  if (!row) return false;
  // Guarded update ensures the row is safe to advance the mark.
  await keyChainMark.raise(userId, row);
  await keyStore.save(userId, ring.key, keyId, {});
  return true;
}

export interface SetupEncryptionResult {
  recoveryCode: string;
}

export async function setupEncryption(
  userId: string,
  passphrase: string,
): Promise<SetupEncryptionResult> {
  const masterKey = await generateMasterKey();

  const [passphraseSalt, recoveryCode, recoverySalt] = await Promise.all([
    generateSalt(),
    generateRecoveryCode(),
    generateSalt(),
  ]);

  const [wrappedByPassphrase, wrappedByRecovery] = await Promise.all([
    deriveKeyFromPassphrase(passphrase, passphraseSalt).then((key) =>
      wrapMasterKey(masterKey, key),
    ),
    deriveKeyFromPassphrase(recoveryCode.raw, recoverySalt).then((key) =>
      wrapMasterKey(masterKey, key),
    ),
  ]);

  // Accounts with pre-existing plaintext must backfill before being marked migrated.
  const pending = await findPendingRows(userId);
  const migratedAt = pending.length === 0 ? new Date().toISOString() : null;

  const supabase = createClient();
  const { error } = await supabase.from("encryption_keys").insert({
    user_id: userId,
    passphrase_salt: await bytesToBase64(passphraseSalt),
    passphrase_kdf_params: DEFAULT_ARGON2_PARAMS,
    wrapped_key_passphrase: wrappedByPassphrase,
    recovery_salt: await bytesToBase64(recoverySalt),
    recovery_kdf_params: DEFAULT_ARGON2_PARAMS,
    wrapped_key_recovery: wrappedByRecovery,
    migrated_at: migratedAt,
    sealed_v2_at: migratedAt,
    rotation_verifier: await rotationVerifier(masterKey),
  });
  if (error) throw error;

  await cacheMasterKey(userId, masterKey, {});

  return { recoveryCode: recoveryCode.formatted };
}

export async function unlockWithPassphrase(
  userId: string,
  passphrase: string,
): Promise<Uint8Array> {
  const row = await fetchEncryptionKeyRow(userId);
  if (!row) {
    throw new UnlockError("Encryption isn't set up for this account yet.");
  }

  const salt = await base64ToBytes(row.passphrase_salt);
  const derivedKey = await deriveKeyFromPassphrase(
    passphrase,
    salt,
    row.passphrase_kdf_params,
  );

  const masterKey = await unwrapOrThrow(
    row.wrapped_key_passphrase,
    derivedKey,
    "That passphrase isn't right.",
  );

  await cacheMasterKey(userId, masterKey, row);
  ensureRotationVerifierInBackground(userId, masterKey, row);
  return masterKey;
}

export async function unlockWithRecoveryCode(
  userId: string,
  recoveryCode: string,
): Promise<Uint8Array> {
  const row = await fetchEncryptionKeyRow(userId);
  if (!row) {
    throw new UnlockError("Encryption isn't set up for this account yet.");
  }

  const salt = await base64ToBytes(row.recovery_salt);
  const derivedKey = await deriveKeyFromPassphrase(
    normalizeRecoveryCode(recoveryCode),
    salt,
    row.recovery_kdf_params,
  );

  const masterKey = await unwrapOrThrow(
    row.wrapped_key_recovery,
    derivedKey,
    "That recovery code isn't right.",
  );

  // Must persist reset requirement before caching to avoid failing open on network error.
  // A direct write, unlike the others, so a mismatched proof cannot block the unlock itself.
  await flagPassphraseReset(userId, currentKeyIdOf(row));
  await cacheMasterKey(userId, masterKey, row);
  ensureRotationVerifierInBackground(userId, masterKey, row);
  return masterKey;
}

async function rewrapPassphrase(
  userId: string,
  masterKey: Uint8Array,
  keyId: string,
  newPassphrase: string,
): Promise<void> {
  const newSalt = await generateSalt();
  const newDerivedKey = await deriveKeyFromPassphrase(newPassphrase, newSalt);
  const newWrapped = await wrapMasterKey(masterKey, newDerivedKey);

  const row = await updateEncryptionKeyRow(userId, masterKey, keyId, {
    passphrase_salt: await bytesToBase64(newSalt),
    passphrase_kdf_params: DEFAULT_ARGON2_PARAMS,
    wrapped_key_passphrase: newWrapped,
    passphrase_reset_required: false,
  });
  await cacheMasterKey(userId, masterKey, row);
}

export async function changePassphrase(
  userId: string,
  currentPassphrase: string,
  newPassphrase: string,
): Promise<void> {
  const row = await fetchEncryptionKeyRow(userId);
  if (!row) {
    throw new UnlockError("Encryption isn't set up for this account yet.");
  }

  const currentSalt = await base64ToBytes(row.passphrase_salt);
  const currentDerivedKey = await deriveKeyFromPassphrase(
    currentPassphrase,
    currentSalt,
    row.passphrase_kdf_params,
  );

  const masterKey = await unwrapOrThrow(
    row.wrapped_key_passphrase,
    currentDerivedKey,
    "That passphrase isn't right.",
  );

  await rewrapPassphrase(userId, masterKey, currentKeyIdOf(row), newPassphrase);
}

export async function setPassphraseAfterRecovery(
  userId: string,
  newPassphrase: string,
): Promise<void> {
  const ring = await keyStore.loadKeyring(userId);
  if (!ring) {
    throw new UnlockError("Unlock before setting a new passphrase.");
  }

  await rewrapPassphrase(userId, ring.key, ring.keyId, newPassphrase);
}

export async function reissueRecoveryCode(userId: string): Promise<string> {
  const ring = await keyStore.loadKeyring(userId);
  if (!ring) {
    throw new UnlockError("Unlock before generating a new recovery code.");
  }

  const recoveryCode = await generateRecoveryCode();
  const recoverySalt = await generateSalt();
  const recoveryKey = await deriveKeyFromPassphrase(
    recoveryCode.raw,
    recoverySalt,
  );
  const wrapped = await wrapMasterKey(ring.key, recoveryKey);

  await updateEncryptionKeyRow(userId, ring.key, ring.keyId, {
    recovery_salt: await bytesToBase64(recoverySalt),
    recovery_kdf_params: DEFAULT_ARGON2_PARAMS,
    wrapped_key_recovery: wrapped,
  });

  return recoveryCode.formatted;
}

export interface RotateContentKeyResult {
  recoveryCode: string;
  // The rotation is committed either way; false means the user must sign out other devices themselves.
  otherSessionsSignedOut: boolean;
  // False means this device still holds only the retired key and must unlock again.
  keySavedOnDevice: boolean;
}

// Every wrapper is prepared before the single RPC, so a failure leaves the key row untouched
// and no recovery code exists to show.
export async function rotateContentKey(
  userId: string,
  currentPassphrase: string,
  newPassphrase: string,
): Promise<RotateContentKeyResult> {
  const ring = await keyStore.loadKeyring(userId);
  if (!ring) {
    throw new UnlockError("Unlock before rotating your content key.");
  }
  const row = await fetchEncryptionKeyRow(userId);
  if (!row) {
    throw new UnlockError("Encryption isn't set up for this account yet.");
  }
  if (ring.keyId !== currentKeyIdOf(row)) {
    throw new UnlockError(KEY_CHANGED_ELSEWHERE);
  }

  // An unlocked device alone must not be able to replace the passphrase and lock the owner out.
  await unwrapOrThrow(
    row.wrapped_key_passphrase,
    await deriveKeyFromPassphrase(
      currentPassphrase,
      await base64ToBytes(row.passphrase_salt),
      row.passphrase_kdf_params,
    ),
    "That passphrase isn't right.",
  );

  const newKey = await generateMasterKey();
  const [passphraseSalt, recoveryCode, recoverySalt] = await Promise.all([
    generateSalt(),
    generateRecoveryCode(),
    generateSalt(),
  ]);
  const [wrappedByPassphrase, wrappedByRecovery] = await Promise.all([
    deriveKeyFromPassphrase(newPassphrase, passphraseSalt).then((key) =>
      wrapMasterKey(newKey, key),
    ),
    deriveKeyFromPassphrase(recoveryCode.raw, recoverySalt).then((key) =>
      wrapMasterKey(newKey, key),
    ),
  ]);

  const retired = { [ring.keyId]: ring.key, ...ring.retired };
  const wrappedRetired = Object.fromEntries(
    await Promise.all(
      Object.entries(retired).map(
        async ([id, key]) => [id, await wrapMasterKey(key, newKey)] as const,
      ),
    ),
  );

  const patch = {
    passphrase_salt: await bytesToBase64(passphraseSalt),
    passphrase_kdf_params: DEFAULT_ARGON2_PARAMS,
    wrapped_key_passphrase: wrappedByPassphrase,
    recovery_salt: await bytesToBase64(recoverySalt),
    recovery_kdf_params: DEFAULT_ARGON2_PARAMS,
    wrapped_key_recovery: wrappedByRecovery,
  };
  const newVerifier = await rotationVerifier(newKey);
  await ensureRotationVerifier(userId, ring.key, row);
  const supabase = createClient();
  const { data: newKeyId, error } = await supabase.rpc("rotate_content_key", {
    p_expected_key_id: Number(ring.keyId),
    p_passphrase_salt: patch.passphrase_salt,
    p_passphrase_kdf_params: patch.passphrase_kdf_params,
    p_wrapped_key_passphrase: patch.wrapped_key_passphrase,
    p_recovery_salt: patch.recovery_salt,
    p_recovery_kdf_params: patch.recovery_kdf_params,
    p_wrapped_key_recovery: patch.wrapped_key_recovery,
    p_retired_keys: wrappedRetired,
    p_rotation_token: await rotationToken(ring.key),
    p_rotation_verifier: newVerifier,
  });
  if (error) throw error;

  // The rotation is committed, so the recovery code must reach the user even if this device
  // can't store the new key.
  let keySavedOnDevice = true;
  try {
    await encryptionKeyRowCache.save(userId, {
      ...row,
      ...patch,
      current_key_id: newKeyId as number,
      retired_keys: wrappedRetired,
      rotation_verifier: newVerifier,
      passphrase_reset_required: false,
    });
    await keyStore.save(userId, newKey, String(newKeyId), retired);
    recordActivity();
  } catch (err) {
    keySavedOnDevice = false;
    Sentry.captureException(err);
    // Until the user unlocks again, the retired key must not seal writes the server rejects.
    try {
      await keyStore.clear();
    } catch (clearErr) {
      Sentry.captureException(clearErr);
    }
  }
  if (keySavedOnDevice) {
    // Failure only defers rollback protection to next unlock; the new key is already saved.
    try {
      await keyChainMark.raise(userId, { current_key_id: newKeyId as number });
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  const { error: signOutError } = await supabase.auth.signOut({
    scope: "others",
  });
  return {
    recoveryCode: recoveryCode.formatted,
    otherSessionsSignedOut: !signOutError,
    keySavedOnDevice,
  };
}
