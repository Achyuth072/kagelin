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

export class UnlockError extends Error {}

async function cacheMasterKey(
  userId: string,
  masterKey: Uint8Array,
  row: Pick<EncryptionKeyRow, "current_key_id" | "retired_keys">,
): Promise<void> {
  const retired = Object.fromEntries(
    await Promise.all(
      Object.entries(row.retired_keys ?? {}).map(
        async ([id, wrapped]) =>
          [id, await unwrapMasterKey(wrapped, masterKey)] as const,
      ),
    ),
  );
  await keyStore.save(userId, masterKey, currentKeyIdOf(row), retired);
  recordActivity();
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

async function updateEncryptionKeyRow(
  userId: string,
  patch: Record<string, unknown>,
): Promise<EncryptionKeyRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("encryption_keys")
    .update(patch)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;

  const row = data as EncryptionKeyRow;
  await encryptionKeyRowCache.save(userId, row);
  return row;
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
    if (row) await encryptionKeyRowCache.save(userId, row);
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

// The blocking pass seals every value row-bound, so it completes both markers.
export async function markMigrationComplete(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await updateEncryptionKeyRow(userId, { migrated_at: now, sealed_v2_at: now });
}

// After this the server rejects `-v1` writes for the Account, and retired keys are gone.
// Guarded on the key id the pass ran under: a rotation since then still needs those keys.
export async function markResealComplete(
  userId: string,
  keyId: string,
): Promise<void> {
  const { data, error } = await createClient()
    .from("encryption_keys")
    .update({ sealed_v2_at: new Date().toISOString(), retired_keys: {} })
    .eq("user_id", userId)
    .eq("current_key_id", Number(keyId))
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) return;
  await encryptionKeyRowCache.save(userId, data as EncryptionKeyRow);
  // The retired keys are gone server-side; drop the local copies too.
  const ring = await keyStore.loadKeyring(userId);
  if (ring?.keyId === keyId) await keyStore.save(userId, ring.key, keyId, {});
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
  await updateEncryptionKeyRow(userId, { passphrase_reset_required: true });
  await cacheMasterKey(userId, masterKey, row);
  return masterKey;
}

async function rewrapPassphrase(
  userId: string,
  masterKey: Uint8Array,
  newPassphrase: string,
): Promise<void> {
  const newSalt = await generateSalt();
  const newDerivedKey = await deriveKeyFromPassphrase(newPassphrase, newSalt);
  const newWrapped = await wrapMasterKey(masterKey, newDerivedKey);

  const row = await updateEncryptionKeyRow(userId, {
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

  await rewrapPassphrase(userId, masterKey, newPassphrase);
}

export async function setPassphraseAfterRecovery(
  userId: string,
  newPassphrase: string,
): Promise<void> {
  const masterKey = await keyStore.load(userId);
  if (!masterKey) {
    throw new UnlockError("Unlock before setting a new passphrase.");
  }

  await rewrapPassphrase(userId, masterKey, newPassphrase);
}

export async function reissueRecoveryCode(userId: string): Promise<string> {
  const masterKey = await keyStore.load(userId);
  if (!masterKey) {
    throw new UnlockError("Unlock before generating a new recovery code.");
  }

  const recoveryCode = await generateRecoveryCode();
  const recoverySalt = await generateSalt();
  const recoveryKey = await deriveKeyFromPassphrase(
    recoveryCode.raw,
    recoverySalt,
  );
  const wrapped = await wrapMasterKey(masterKey, recoveryKey);

  await updateEncryptionKeyRow(userId, {
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
  });
  if (error) throw error;

  // The rotation is committed, so the recovery code must reach the user even if this device
  // can't store the new key; it then asks to unlock again with the new passphrase.
  try {
    await encryptionKeyRowCache.save(userId, {
      ...row,
      ...patch,
      current_key_id: newKeyId as number,
      retired_keys: wrappedRetired,
      passphrase_reset_required: false,
    });
    await keyStore.save(userId, newKey, String(newKeyId), retired);
    recordActivity();
  } catch (err) {
    Sentry.captureException(err);
  }

  const { error: signOutError } = await supabase.auth.signOut({
    scope: "others",
  });
  return {
    recoveryCode: recoveryCode.formatted,
    otherSessionsSignedOut: !signOutError,
  };
}
