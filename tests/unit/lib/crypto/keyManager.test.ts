import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabaseClient } from "../../support/fakeSupabaseClient";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = new Map<string, Row>();
let lastUpdatePayload: Row | null = null;
let updateError: Error | null = null;
let offline = false;

function createEncryptionKeysTable() {
  return {
    select: () => ({
      eq: (_col: string, userId: string) => ({
        maybeSingle: async () => {
          if (offline) throw new Error("Failed to fetch");
          return { data: rows.get(userId) ?? null, error: null };
        },
      }),
    }),
    insert: async (payload: Row) => {
      rows.set(payload.user_id, { ...payload });
      return { error: null };
    },
    update: (payload: Row) => ({
      eq: (_col: string, userId: string) => {
        let guardKeyId: number | null = null;
        const apply = () => {
          const current = rows.get(userId);
          if (
            guardKeyId !== null &&
            (current?.current_key_id ?? 1) !== guardKeyId
          )
            return null;
          lastUpdatePayload = payload;
          rows.set(userId, { ...current, ...payload });
          return rows.get(userId) ?? null;
        };
        const builder = {
          eq: (_c: string, value: number) => {
            guardKeyId = value;
            return builder;
          },
          then: (onFulfilled: (v: { data: null; error: null }) => unknown) => {
            apply();
            return Promise.resolve({ data: null, error: null }).then(
              onFulfilled,
            );
          },
          select: () => ({
            single: async () => {
              if (updateError) return { data: null, error: updateError };
              return { data: apply(), error: null };
            },
            maybeSingle: async () => {
              if (updateError) return { data: null, error: updateError };
              return { data: apply(), error: null };
            },
          }),
        };
        return builder;
      },
    }),
  };
}

let rpcError: Error | null = null;
let signOutError: Error | null = null;
const signOutMock = vi.fn(async (_options: unknown) => ({
  error: signOutError,
}));
const rpcMock = vi.fn(async (_name: string, args: Row) => {
  if (rpcError) return { data: null, error: rpcError };
  const userId = [...rows.keys()][0];
  const current = rows.get(userId)!;
  const keyId = current.current_key_id ?? 1;
  if (keyId !== args.p_expected_key_id) {
    return { data: null, error: new Error("content key changed") };
  }
  rows.set(userId, {
    ...current,
    passphrase_salt: args.p_passphrase_salt,
    passphrase_kdf_params: args.p_passphrase_kdf_params,
    wrapped_key_passphrase: args.p_wrapped_key_passphrase,
    recovery_salt: args.p_recovery_salt,
    recovery_kdf_params: args.p_recovery_kdf_params,
    wrapped_key_recovery: args.p_wrapped_key_recovery,
    retired_keys: args.p_retired_keys,
    current_key_id: keyId + 1,
  });
  return { data: keyId + 1, error: null };
});

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table !== "encryption_keys")
      throw new Error(`Unexpected table: ${table}`);
    return createEncryptionKeysTable();
  }),
  rpc: rpcMock,
  auth: { signOut: signOutMock },
};

let rawClient = createFakeSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
  createRawClient: () => rawClient,
}));

const keyStoreState: {
  userId: string | null;
  key: Uint8Array | null;
  keyId: string;
  retired: Record<string, Uint8Array>;
} = {
  userId: null,
  key: null,
  keyId: "1",
  retired: {},
};
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async (userId?: string) =>
      userId !== undefined && keyStoreState.userId !== userId
        ? null
        : keyStoreState.key,
    ),
    loadKeyring: vi.fn(async (userId?: string) =>
      keyStoreState.key &&
      (userId === undefined || keyStoreState.userId === userId)
        ? {
            keyId: keyStoreState.keyId,
            key: keyStoreState.key,
            retired: keyStoreState.retired,
          }
        : null,
    ),
    save: vi.fn(
      async (
        userId: string,
        k: Uint8Array,
        keyId = "1",
        retired: Record<string, Uint8Array> = {},
      ) => {
        keyStoreState.userId = userId;
        keyStoreState.key = k;
        keyStoreState.keyId = keyId;
        keyStoreState.retired = retired;
      },
    ),
    clear: vi.fn(async () => {
      keyStoreState.userId = null;
      keyStoreState.key = null;
      keyStoreState.keyId = "1";
      keyStoreState.retired = {};
    }),
  },
}));

const recordActivityMock = vi.fn();
vi.mock("@/lib/crypto/autoLock", () => ({
  recordActivity: () => recordActivityMock(),
}));

const rowCache = new Map<string, Row>();
vi.mock("@/lib/crypto/encryptionKeyRowCache", () => ({
  encryptionKeyRowCache: {
    load: vi.fn(async (userId: string) => rowCache.get(userId) ?? null),
    save: vi.fn(async (userId: string, row: Row) => {
      rowCache.set(userId, row);
    }),
  },
}));

const NOTHING_SEEN = { keyId: 0, sealedV2: false, retiredClearedAt: 0 };
const marks = new Map<string, typeof NOTHING_SEEN>();
vi.mock("@/lib/crypto/keyChainMark", () => ({
  keyChainMark: {
    load: vi.fn(async (userId: string) => marks.get(userId) ?? NOTHING_SEEN),
    raise: vi.fn(async (userId: string, row: Row) => {
      const seen = marks.get(userId) ?? NOTHING_SEEN;
      const keyId = row.current_key_id ?? 1;
      const cleared =
        !!row.retired_keys && Object.keys(row.retired_keys).length === 0;
      marks.set(userId, {
        keyId: Math.max(seen.keyId, keyId),
        sealedV2: seen.sealedV2 || !!row.sealed_v2_at,
        retiredClearedAt: cleared
          ? Math.max(seen.retiredClearedAt, keyId)
          : seen.retiredClearedAt,
      });
    }),
  },
}));

const captureExceptionMock = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (err: unknown) => captureExceptionMock(err),
}));

import { keyStore } from "@/lib/crypto/keyStore";
import {
  setupEncryption,
  unlockWithPassphrase,
  unlockWithRecoveryCode,
  changePassphrase,
  setPassphraseAfterRecovery,
  reissueRecoveryCode,
  hasEncryptionKey,
  getEncryptionKeyRow,
  markMigrationComplete,
  markResealComplete,
  rotateContentKey,
  UnlockError,
} from "@/lib/crypto/keyManager";

const USER_ID = "user-1";

describe("keyManager", () => {
  beforeEach(() => {
    rows.clear();
    rowCache.clear();
    marks.clear();
    lastUpdatePayload = null;
    updateError = null;
    rpcError = null;
    signOutError = null;
    keyStoreState.key = null;
    keyStoreState.keyId = "1";
    keyStoreState.retired = {};
    offline = false;
    rawClient = createFakeSupabaseClient();
    vi.clearAllMocks();
  });

  it("setupEncryption is unlockable by both the passphrase and the recovery code it issues", async () => {
    const { recoveryCode } = await setupEncryption(USER_ID, "first passphrase");
    expect(await hasEncryptionKey(USER_ID)).toBe(true);

    const byPassphrase = await unlockWithPassphrase(
      USER_ID,
      "first passphrase",
    );
    const byRecovery = await unlockWithRecoveryCode(USER_ID, recoveryCode);

    expect(byPassphrase).toEqual(byRecovery);
  }, 20000);

  it("rejects the wrong passphrase", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    await expect(
      unlockWithPassphrase(USER_ID, "wrong passphrase"),
    ).rejects.toThrow(UnlockError);
  }, 20000);

  it("rejects the wrong recovery code", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    await expect(
      unlockWithRecoveryCode(
        USER_ID,
        "0000-0000-0000-0000-0000-0000-0000-0000",
      ),
    ).rejects.toThrow(UnlockError);
  }, 20000);

  it("rejects unlocking an account with no key set up", async () => {
    await expect(unlockWithPassphrase(USER_ID, "anything")).rejects.toThrow(
      UnlockError,
    );
  });

  it("changePassphrase rewraps only the passphrase columns, leaving the recovery wrap byte-identical", async () => {
    const { recoveryCode } = await setupEncryption(USER_ID, "old passphrase");
    const before = { ...rows.get(USER_ID) };

    await changePassphrase(USER_ID, "old passphrase", "new passphrase");

    const after = rows.get(USER_ID)!;
    expect(after.recovery_salt).toBe(before.recovery_salt);
    expect(after.wrapped_key_recovery).toBe(before.wrapped_key_recovery);
    expect(after.recovery_kdf_params).toEqual(before.recovery_kdf_params);
    expect(after.passphrase_salt).not.toBe(before.passphrase_salt);
    expect(after.wrapped_key_passphrase).not.toBe(
      before.wrapped_key_passphrase,
    );

    expect(lastUpdatePayload).not.toHaveProperty("wrapped_key_recovery");
    expect(lastUpdatePayload).not.toHaveProperty("recovery_salt");

    await expect(
      unlockWithPassphrase(USER_ID, "old passphrase"),
    ).rejects.toThrow(UnlockError);
    const byNewPassphrase = await unlockWithPassphrase(
      USER_ID,
      "new passphrase",
    );
    const byRecovery = await unlockWithRecoveryCode(USER_ID, recoveryCode);
    expect(byNewPassphrase).toEqual(byRecovery);
  }, 20000);

  it("changePassphrase leaves the row untouched when the current passphrase is wrong", async () => {
    await setupEncryption(USER_ID, "old passphrase");
    const before = { ...rows.get(USER_ID) };

    await expect(
      changePassphrase(USER_ID, "wrong passphrase", "new passphrase"),
    ).rejects.toThrow(UnlockError);

    expect(rows.get(USER_ID)).toEqual(before);
  }, 20000);

  it("reissueRecoveryCode rewraps only the recovery columns, leaving the passphrase wrap byte-identical", async () => {
    await setupEncryption(USER_ID, "my passphrase");
    const before = { ...rows.get(USER_ID) };

    const newCode = await reissueRecoveryCode(USER_ID);

    const after = rows.get(USER_ID)!;
    expect(after.passphrase_salt).toBe(before.passphrase_salt);
    expect(after.wrapped_key_passphrase).toBe(before.wrapped_key_passphrase);
    expect(after.recovery_salt).not.toBe(before.recovery_salt);
    expect(after.wrapped_key_recovery).not.toBe(before.wrapped_key_recovery);

    const byPassphrase = await unlockWithPassphrase(USER_ID, "my passphrase");
    const byNewRecovery = await unlockWithRecoveryCode(USER_ID, newCode);
    expect(byPassphrase).toEqual(byNewRecovery);
  }, 20000);

  it("setPassphraseAfterRecovery rewraps the passphrase columns without requiring the old passphrase", async () => {
    const { recoveryCode } = await setupEncryption(
      USER_ID,
      "forgotten passphrase",
    );
    await unlockWithRecoveryCode(USER_ID, recoveryCode);
    const before = { ...rows.get(USER_ID) };

    await setPassphraseAfterRecovery(USER_ID, "brand new passphrase");

    const after = rows.get(USER_ID)!;
    expect(after.passphrase_salt).not.toBe(before.passphrase_salt);
    expect(after.wrapped_key_passphrase).not.toBe(
      before.wrapped_key_passphrase,
    );
    expect(after.recovery_salt).toBe(before.recovery_salt);
    expect(after.wrapped_key_recovery).toBe(before.wrapped_key_recovery);

    await expect(
      unlockWithPassphrase(USER_ID, "forgotten passphrase"),
    ).rejects.toThrow(UnlockError);
    const masterKey = await unlockWithPassphrase(
      USER_ID,
      "brand new passphrase",
    );
    expect(masterKey).toBeInstanceOf(Uint8Array);
  }, 20000);

  it("unlockWithRecoveryCode flags the row as needing a passphrase reset, and setPassphraseAfterRecovery clears the flag", async () => {
    const { recoveryCode } = await setupEncryption(USER_ID, "old passphrase");
    expect(rows.get(USER_ID)!.passphrase_reset_required).toBeFalsy();

    await unlockWithRecoveryCode(USER_ID, recoveryCode);
    expect(rows.get(USER_ID)!.passphrase_reset_required).toBe(true);

    await setPassphraseAfterRecovery(USER_ID, "brand new passphrase");
    expect(rows.get(USER_ID)!.passphrase_reset_required).toBe(false);
  }, 20000);

  it("unlockWithRecoveryCode does not cache the master key if flagging passphrase_reset_required fails", async () => {
    const { recoveryCode } = await setupEncryption(USER_ID, "old passphrase");
    keyStoreState.key = null;
    keyStoreState.userId = null;

    updateError = new Error("Database network error");

    await expect(unlockWithRecoveryCode(USER_ID, recoveryCode)).rejects.toThrow(
      "Database network error",
    );

    expect(keyStoreState.key).toBeNull();
  }, 20000);

  it("setPassphraseAfterRecovery requires an unlocked device", async () => {
    await setupEncryption(USER_ID, "my passphrase");
    keyStoreState.key = null;

    await expect(
      setPassphraseAfterRecovery(USER_ID, "new passphrase"),
    ).rejects.toThrow(UnlockError);
  }, 20000);

  it("reissueRecoveryCode requires an unlocked device", async () => {
    await setupEncryption(USER_ID, "my passphrase");
    keyStoreState.key = null;

    await expect(reissueRecoveryCode(USER_ID)).rejects.toThrow(UnlockError);
  }, 20000);

  it("unlocks offline using the wrapped key row cached from an earlier online fetch — CONTEXT.md requires this", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    await hasEncryptionKey(USER_ID);
    keyStoreState.key = null;

    offline = true;
    const masterKey = await unlockWithPassphrase(USER_ID, "first passphrase");

    expect(masterKey).toBeInstanceOf(Uint8Array);
  }, 20000);

  it("still rejects a wrong passphrase offline, using the cached row", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    await hasEncryptionKey(USER_ID);
    keyStoreState.key = null;

    offline = true;
    await expect(
      unlockWithPassphrase(USER_ID, "wrong passphrase"),
    ).rejects.toThrow(UnlockError);
  }, 20000);

  it("throws the underlying error when offline with nothing cached yet", async () => {
    offline = true;
    await expect(unlockWithPassphrase(USER_ID, "anything")).rejects.toThrow(
      "Failed to fetch",
    );
  });

  it("changePassphrase refreshes the offline cache, so a later offline unlock sees the new passphrase, not the old one", async () => {
    await setupEncryption(USER_ID, "old passphrase");
    await hasEncryptionKey(USER_ID);
    await changePassphrase(USER_ID, "old passphrase", "new passphrase");
    keyStoreState.key = null;

    offline = true;
    await expect(
      unlockWithPassphrase(USER_ID, "old passphrase"),
    ).rejects.toThrow(UnlockError);
    const masterKey = await unlockWithPassphrase(USER_ID, "new passphrase");
    expect(masterKey).toBeInstanceOf(Uint8Array);
  }, 20000);

  it("reissueRecoveryCode refreshes the offline cache, so a later offline unlock sees the new code, not the invalidated one", async () => {
    const { recoveryCode: oldCode } = await setupEncryption(
      USER_ID,
      "my passphrase",
    );
    await hasEncryptionKey(USER_ID);
    const newCode = await reissueRecoveryCode(USER_ID);

    offline = true;
    await expect(unlockWithRecoveryCode(USER_ID, oldCode)).rejects.toThrow(
      UnlockError,
    );
    const masterKey = await unlockWithRecoveryCode(USER_ID, newCode);
    expect(masterKey).toBeInstanceOf(Uint8Array);
  }, 20000);

  it("setupEncryption marks a fresh account as already migrated — it has no pre-existing plaintext to backfill", async () => {
    await setupEncryption(USER_ID, "first passphrase");

    expect((await getEncryptionKeyRow(USER_ID))?.migrated_at).toEqual(
      expect.any(String),
    );
  }, 20000);

  it("setupEncryption seals a fresh account's first write row-bound, so it needs no Re-seal", async () => {
    await setupEncryption(USER_ID, "first passphrase");

    expect((await getEncryptionKeyRow(USER_ID))?.sealed_v2_at).toEqual(
      expect.any(String),
    );
  }, 20000);

  it("markResealComplete sets only the -v2 marker, leaving migrated_at alone", async () => {
    rawClient = createFakeSupabaseClient({
      tasks: [{ id: "t1", user_id: USER_ID, content: "Buy milk" }],
    });
    await setupEncryption(USER_ID, "first passphrase");

    await markResealComplete(USER_ID, "1");

    const row = await getEncryptionKeyRow(USER_ID);
    expect(row?.sealed_v2_at).toEqual(expect.any(String));
    expect(row?.migrated_at).toBeNull();
  }, 20000);

  it("markMigrationComplete sets both markers", async () => {
    rawClient = createFakeSupabaseClient({
      tasks: [{ id: "t1", user_id: USER_ID, content: "Buy milk" }],
    });
    await setupEncryption(USER_ID, "first passphrase");

    await markMigrationComplete(USER_ID);

    const row = await getEncryptionKeyRow(USER_ID);
    expect(row?.migrated_at).toEqual(expect.any(String));
    expect(row?.sealed_v2_at).toEqual(expect.any(String));
  }, 20000);

  it("setupEncryption leaves migrated_at null for an account with pre-existing plaintext, so the backfill migration still runs", async () => {
    rawClient = createFakeSupabaseClient({
      tasks: [{ id: "t1", user_id: USER_ID, content: "Buy milk" }],
    });

    await setupEncryption(USER_ID, "first passphrase");

    expect((await getEncryptionKeyRow(USER_ID))?.migrated_at).toBeNull();
  }, 20000);

  it("markMigrationComplete refreshes the offline cache, so a later offline check sees migration as done", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    await hasEncryptionKey(USER_ID);
    await markMigrationComplete(USER_ID);

    offline = true;
    expect((await getEncryptionKeyRow(USER_ID))?.migrated_at).toEqual(
      expect.any(String),
    );
  }, 20000);
  it("restarts the idle clock whenever the master key is cached on the device", async () => {
    const { recoveryCode } = await setupEncryption(USER_ID, "first passphrase");
    expect(recordActivityMock).toHaveBeenCalledTimes(1);

    await unlockWithPassphrase(USER_ID, "first passphrase");
    expect(recordActivityMock).toHaveBeenCalledTimes(2);

    await unlockWithRecoveryCode(USER_ID, recoveryCode);
    expect(recordActivityMock).toHaveBeenCalledTimes(3);

    await changePassphrase(USER_ID, "first passphrase", "second passphrase");
    expect(recordActivityMock).toHaveBeenCalledTimes(4);
  }, 30000);

  it("leaves the idle clock alone when unlocking fails", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    recordActivityMock.mockClear();

    await expect(
      unlockWithPassphrase(USER_ID, "wrong passphrase"),
    ).rejects.toThrow(UnlockError);

    expect(recordActivityMock).not.toHaveBeenCalled();
  }, 20000);

  describe("rotateContentKey", () => {
    async function setupAndRotate() {
      await setupEncryption(USER_ID, "old passphrase");
      const oldKey = keyStoreState.key!;
      const result = await rotateContentKey(
        USER_ID,
        "old passphrase",
        "new passphrase",
      );
      return { oldKey, result };
    }

    it("unlocks with the new passphrase and the new recovery code", async () => {
      const { oldKey, result } = await setupAndRotate();
      const newKey = keyStoreState.key!;
      expect(newKey).not.toEqual(oldKey);

      expect(await unlockWithPassphrase(USER_ID, "new passphrase")).toEqual(
        newKey,
      );
      expect(
        await unlockWithRecoveryCode(USER_ID, result.recoveryCode),
      ).toEqual(newKey);
    }, 60000);

    it("rejects the old passphrase and the old recovery code", async () => {
      const { recoveryCode: oldCode } = await setupEncryption(
        USER_ID,
        "old passphrase",
      );
      await rotateContentKey(USER_ID, "old passphrase", "new passphrase");

      await expect(
        unlockWithPassphrase(USER_ID, "old passphrase"),
      ).rejects.toBeInstanceOf(UnlockError);
      await expect(
        unlockWithRecoveryCode(USER_ID, oldCode),
      ).rejects.toBeInstanceOf(UnlockError);
    }, 60000);

    it("advances the key id and keeps the old key reachable only through the new key", async () => {
      const { oldKey } = await setupAndRotate();

      expect(keyStoreState.keyId).toBe("2");
      expect(keyStoreState.retired["1"]).toEqual(oldKey);

      // A fresh device unlocking sees the same keyring, rebuilt from the wrapped chain.
      await keyStore.clear();
      await unlockWithPassphrase(USER_ID, "new passphrase");
      expect(keyStoreState.keyId).toBe("2");
      expect(keyStoreState.retired["1"]).toEqual(oldKey);
    }, 60000);

    it("keeps every earlier retired key when rotating again", async () => {
      const { oldKey } = await setupAndRotate();
      const secondKey = keyStoreState.key!;
      await rotateContentKey(USER_ID, "new passphrase", "third passphrase");

      expect(keyStoreState.keyId).toBe("3");
      expect(keyStoreState.retired["1"]).toEqual(oldKey);
      expect(keyStoreState.retired["2"]).toEqual(secondKey);
    }, 90000);

    it("refuses to unlock with a key row older than one this device has seen", async () => {
      await setupEncryption(USER_ID, "old passphrase");
      await getEncryptionKeyRow(USER_ID);
      const beforeRotation = { ...rows.get(USER_ID) };
      await rotateContentKey(USER_ID, "old passphrase", "new passphrase");
      const rotatedKey = keyStoreState.key!;

      rows.set(USER_ID, beforeRotation);

      await expect(
        unlockWithPassphrase(USER_ID, "old passphrase"),
      ).rejects.toBeInstanceOf(UnlockError);
      expect(keyStoreState.key).toEqual(rotatedKey);
      expect(keyStoreState.keyId).toBe("2");
    }, 60000);

    it("does not let a key row the user never unlocked raise the key id it requires", async () => {
      await setupEncryption(USER_ID, "old passphrase");
      const honest = { ...rows.get(USER_ID) };
      rows.set(USER_ID, { ...honest, current_key_id: 99 });
      await getEncryptionKeyRow(USER_ID);

      rows.set(USER_ID, honest);

      await expect(
        unlockWithPassphrase(USER_ID, "old passphrase"),
      ).resolves.toBeInstanceOf(Uint8Array);
    }, 60000);

    it("leaves the key row untouched and returns no recovery code when the RPC fails", async () => {
      await setupEncryption(USER_ID, "old passphrase");
      const before = { ...rows.get(USER_ID) };
      const oldKey = keyStoreState.key!;
      rpcError = new Error("network dropped");

      await expect(
        rotateContentKey(USER_ID, "old passphrase", "new passphrase"),
      ).rejects.toThrow("network dropped");

      expect(rows.get(USER_ID)).toEqual(before);
      expect(keyStoreState.key).toEqual(oldKey);
      expect(keyStoreState.keyId).toBe("1");
      expect(signOutMock).not.toHaveBeenCalled();
    }, 60000);

    it("signs out every other session only after the commit", async () => {
      await setupAndRotate();
      expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
      expect(rpcMock.mock.invocationCallOrder[0]).toBeLessThan(
        signOutMock.mock.invocationCallOrder[0],
      );
    }, 60000);

    it("still returns the recovery code if signing out other sessions fails", async () => {
      await setupEncryption(USER_ID, "old passphrase");
      signOutError = new Error("offline");

      const result = await rotateContentKey(
        USER_ID,
        "old passphrase",
        "new passphrase",
      );

      expect(result.recoveryCode).toMatch(/^[0-9A-Z-]+$/);
      expect(result.otherSessionsSignedOut).toBe(false);
    }, 60000);

    it("keeps the -v2 marker through a rotation, so -v1 writes stay rejected", async () => {
      await setupAndRotate();
      expect(rows.get(USER_ID)?.sealed_v2_at).toEqual(expect.any(String));
      expect(rowCache.get(USER_ID)?.sealed_v2_at).toEqual(expect.any(String));
    }, 60000);

    it("still returns the committed recovery code if saving the new key on this device fails", async () => {
      await setupEncryption(USER_ID, "old passphrase");
      const saveError = new Error("IndexedDB quota exceeded");
      vi.mocked(keyStore.save).mockRejectedValueOnce(saveError);

      const result = await rotateContentKey(
        USER_ID,
        "old passphrase",
        "new passphrase",
      );

      expect(rows.get(USER_ID)?.current_key_id).toBe(2);
      expect(result.recoveryCode).toMatch(/^[0-9A-Z-]+$/);
      expect(captureExceptionMock).toHaveBeenCalledWith(saveError);
      expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
      expect(result.keySavedOnDevice).toBe(false);
    }, 60000);

    it("drops the retired key from this device when the new one could not be saved, so no write reaches the server with it", async () => {
      await setupEncryption(USER_ID, "old passphrase");
      vi.mocked(keyStore.save).mockRejectedValueOnce(new Error("quota"));

      await rotateContentKey(USER_ID, "old passphrase", "new passphrase");

      expect(await keyStore.loadKeyring(USER_ID)).toBeNull();
    }, 60000);

    it("reports it, and still returns the recovery code, when the retired key cannot be dropped either", async () => {
      await setupEncryption(USER_ID, "old passphrase");
      const clearError = new Error("storage unavailable");
      vi.mocked(keyStore.save).mockRejectedValueOnce(new Error("quota"));
      vi.mocked(keyStore.clear).mockRejectedValueOnce(clearError);

      const result = await rotateContentKey(
        USER_ID,
        "old passphrase",
        "new passphrase",
      );

      expect(captureExceptionMock).toHaveBeenCalledWith(clearError);
      expect(result.recoveryCode).toMatch(/^[0-9A-Z-]+$/);
      expect(result.keySavedOnDevice).toBe(false);
    }, 60000);

    it("refuses a stale device's key-row writes after a rotation on another device", async () => {
      const { oldKey } = await setupAndRotate();
      const after = structuredClone(rows.get(USER_ID));
      keyStoreState.key = oldKey;
      keyStoreState.keyId = "1";
      keyStoreState.retired = {};

      await expect(reissueRecoveryCode(USER_ID)).rejects.toBeInstanceOf(
        UnlockError,
      );
      await expect(
        setPassphraseAfterRecovery(USER_ID, "stale passphrase"),
      ).rejects.toBeInstanceOf(UnlockError);
      expect(rows.get(USER_ID)).toEqual(after);
    }, 60000);

    it("refuses a passphrase change that a rotation overtook", async () => {
      await setupEncryption(USER_ID, "old passphrase");
      const fetched = structuredClone(rows.get(USER_ID));
      await rotateContentKey(USER_ID, "old passphrase", "new passphrase");
      const after = structuredClone(rows.get(USER_ID));
      // The change read the key row before the rotation committed.
      rows.set(USER_ID, fetched!);
      const readBeforeRotation = changePassphrase(
        USER_ID,
        "old passphrase",
        "changed passphrase",
      );
      rows.set(USER_ID, after!);

      await expect(readBeforeRotation).rejects.toBeInstanceOf(UnlockError);
      expect(rows.get(USER_ID)).toEqual(after);
    }, 60000);

    it("refuses to rotate without the current passphrase, leaving the key row untouched", async () => {
      await setupEncryption(USER_ID, "old passphrase");
      const before = { ...rows.get(USER_ID) };

      await expect(
        rotateContentKey(USER_ID, "wrong passphrase", "new passphrase"),
      ).rejects.toBeInstanceOf(UnlockError);

      expect(rpcMock).not.toHaveBeenCalled();
      expect(rows.get(USER_ID)).toEqual(before);
    }, 60000);

    it("refuses to rotate while locked", async () => {
      await setupEncryption(USER_ID, "old passphrase");
      await keyStore.clear();
      await expect(
        rotateContentKey(USER_ID, "old passphrase", "new passphrase"),
      ).rejects.toBeInstanceOf(UnlockError);
    }, 60000);

    it("markResealComplete drops retired keys, but not after a newer rotation", async () => {
      await setupAndRotate();
      expect(await markResealComplete(USER_ID, "1")).toBe(false);
      expect(rows.get(USER_ID)?.retired_keys).toHaveProperty("1");

      expect(await markResealComplete(USER_ID, "2")).toBe(true);
      expect(rows.get(USER_ID)?.retired_keys).toEqual({});
      expect(keyStoreState.retired).toEqual({});
      expect(rows.get(USER_ID)?.sealed_v2_at).toEqual(expect.any(String));
    }, 60000);

    it("ignores retired keys written back after this device saw them cleared, and reports it", async () => {
      await setupAndRotate();
      const replayed = structuredClone(rows.get(USER_ID)!.retired_keys);
      await markResealComplete(USER_ID, "2");
      vi.clearAllMocks();

      rows.set(USER_ID, { ...rows.get(USER_ID)!, retired_keys: replayed });
      await keyStore.clear();
      await unlockWithPassphrase(USER_ID, "new passphrase");

      expect(keyStoreState.keyId).toBe("2");
      expect(keyStoreState.retired).toEqual({});
      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    }, 60000);

    it("still loads the retired keys of a rotation after an earlier clear", async () => {
      await setupAndRotate();
      const secondKey = keyStoreState.key!;
      await markResealComplete(USER_ID, "2");
      await rotateContentKey(USER_ID, "new passphrase", "third passphrase");

      await keyStore.clear();
      await unlockWithPassphrase(USER_ID, "third passphrase");

      expect(keyStoreState.keyId).toBe("3");
      expect(keyStoreState.retired).toEqual({ "2": secondKey });
      expect(captureExceptionMock).not.toHaveBeenCalled();
    }, 90000);
  });
});
