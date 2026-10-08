"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/nextjs";
import { useAuth } from "@/components/AuthProvider";
import { onServerKeySignal } from "@/lib/supabase/wrapClient";
import { notify } from "@/lib/notify";
import { getEncryptionKeyRow } from "@/lib/crypto/keyManager";
import type { EncryptionKeyRow } from "@/lib/crypto/encryptionKeyRowCache";
import { keyStore } from "@/lib/crypto/keyStore";
import { currentKeyIdOf } from "@/lib/crypto/keyring";
import { purgeDeviceContent } from "@/lib/crypto/purge";
import { recordActivity, shouldAutoLockNow } from "@/lib/crypto/autoLock";
import { useAutoLockTimer } from "@/lib/hooks/useAutoLockTimer";
import { useUiStore } from "@/lib/store/uiStore";

export type EncryptionGateStatus =
  | "loading"
  | "not-applicable"
  | "needs-setup"
  | "needs-unlock"
  | "needs-migration"
  | "needs-passphrase-reset"
  | "unlocked"
  | "unavailable";

type AsyncStatus = Exclude<EncryptionGateStatus, "not-applicable">;

export type LockReason = "key-changed";

// The caller's own error toast is silent for this rejection, so a device that stays
// unlocked must still say that a save failed.
function notifyRejectedSave() {
  notify.error(
    "Changes couldn't be saved because your content key just changed. Unlock the app again if this keeps happening.",
    { id: "content-key-rejected" },
  );
}

function isKeyRetired(
  row: EncryptionKeyRow | null,
  keyring: { keyId: string } | null,
): boolean {
  return (
    !!row && !!keyring && Number(keyring.keyId) < Number(currentKeyIdOf(row))
  );
}

function resolveStatus(
  row: EncryptionKeyRow | null,
  cachedKey: Uint8Array | null,
): AsyncStatus {
  if (!row) return "needs-setup";
  if (!cachedKey) return "needs-unlock";
  // Legacy cached rows lack migrated_at; explicit null triggers migration.
  if (row.migrated_at === null) return "needs-migration";
  if (row.passphrase_reset_required) return "needs-passphrase-reset";
  return "unlocked";
}

// Re-reads the keyring so a key this device saved meanwhile (a rotation) is not overwritten.
async function dropRetiredKeysNotIn(
  userId: string,
  keyId: string,
  serverRetired: Record<string, unknown>,
): Promise<void> {
  const ring = await keyStore.loadKeyring(userId);
  if (!ring || ring.keyId !== keyId) return;
  const kept = Object.entries(ring.retired).filter(
    ([id]) => id in serverRetired,
  );
  if (kept.length < Object.keys(ring.retired).length) {
    await keyStore.save(userId, ring.key, keyId, Object.fromEntries(kept));
  }
}

export function useEncryptionGate(): {
  status: EncryptionGateStatus;
  recheck: () => void;
  lock: () => Promise<void>;
  resealDue: boolean;
  // Changes when a new Re-seal must replace a running one, as after a rotation.
  resealRun: number;
  // Takes the run it finishes, so a run a rotation replaced cannot end the new one.
  finishReseal: (run: number) => void;
  beginReseal: () => void;
  lockReason: LockReason | null;
  // While true, a rejected key does not lock the device, so the recovery code survives.
  holdForRecoveryCode: (held: boolean) => void;
} {
  const { user, loading: authLoading, isGuestMode } = useAuth();
  const queryClient = useQueryClient();
  const [asyncStatus, setAsyncStatus] = useState<AsyncStatus>("loading");
  const [version, setVersion] = useState(0);
  // 0 while no Re-seal is due.
  const [resealRun, setResealRun] = useState(0);
  const [lockReason, setLockReason] = useState<LockReason | null>(null);
  const recoveryCodeHeldRef = useRef(false);
  const lockingForKeyRef = useRef(false);
  const asyncStatusRef = useRef(asyncStatus);
  useEffect(() => {
    asyncStatusRef.current = asyncStatus;
  }, [asyncStatus]);
  const autoLockEnabled = useUiStore((s) => s.autoLockEnabled);
  const autoLockMinutes = useUiStore((s) => s.autoLockMinutes);
  // Avoid re-running the status effect on settings changes.
  const autoLockEnabledRef = useRef(autoLockEnabled);
  const autoLockMinutesRef = useRef(autoLockMinutes);
  useEffect(() => {
    autoLockEnabledRef.current = autoLockEnabled;
    autoLockMinutesRef.current = autoLockMinutes;
  }, [autoLockEnabled, autoLockMinutes]);

  const notApplicable = !authLoading && (!user || isGuestMode);
  // Key on user ID so auth token refreshes do not re-run the gate effect.
  const userId = user?.id;

  useEffect(() => {
    if (authLoading || notApplicable || !userId) return;

    let cancelled = false;

    (async () => {
      try {
        // Read fresh to avoid purging if another tab rotated the key.
        const [row, keyring] = await Promise.all([
          getEncryptionKeyRow(userId),
          keyStore.loadKeyring(userId, { fresh: true }),
        ]);
        if (cancelled) return;

        const rowKeyId = currentKeyIdOf(row);
        // The retired key is the leaked one, so it goes with everything it decrypted.
        if (isKeyRetired(row, keyring)) {
          await purgeDeviceContent(queryClient);
          if (!cancelled) {
            setLockReason("key-changed");
            setAsyncStatus("needs-unlock");
          }
          return;
        }
        const cachedKey =
          keyring && keyring.keyId === rowKeyId ? keyring.key : null;

        // Another device's Re-seal deleted these server-side. A row cached before the
        // column existed says nothing about them.
        if (row?.retired_keys && cachedKey) {
          await dropRetiredKeysNotIn(userId, rowKeyId, row.retired_keys);
        }

        const wouldUnlock =
          !!row &&
          !!cachedKey &&
          row.migrated_at !== null &&
          !row.passphrase_reset_required;
        if (
          shouldAutoLockNow(
            {
              enabled: autoLockEnabledRef.current,
              minutes: autoLockMinutesRef.current,
            },
            wouldUnlock,
          )
        ) {
          await purgeDeviceContent(queryClient);
          if (!cancelled) setAsyncStatus("needs-unlock");
          return;
        }

        const status = resolveStatus(row, cachedKey);
        const resealDue =
          status === "unlocked" &&
          (row?.sealed_v2_at === null ||
            Object.keys(row?.retired_keys ?? {}).length > 0);
        setResealRun((run) => (resealDue ? run || 1 : 0));
        setAsyncStatus(status);
      } catch {
        if (!cancelled) setAsyncStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, notApplicable, version, queryClient]);

  useEffect(() => {
    if (!userId) return;
    return onServerKeySignal(async (signal) => {
      if (
        signal !== "content_key_retired" ||
        lockingForKeyRef.current ||
        asyncStatusRef.current !== "unlocked"
      ) {
        return;
      }
      if (recoveryCodeHeldRef.current) {
        notifyRejectedSave();
        return;
      }
      // A burst of rejected writes would otherwise each start their own check and purge.
      lockingForKeyRef.current = true;
      try {
        const [row, keyring] = await Promise.all([
          getEncryptionKeyRow(userId),
          keyStore.loadKeyring(userId, { fresh: true }),
        ]);
        // The check awaits the network; a hold set meanwhile still applies.
        if (recoveryCodeHeldRef.current || !isKeyRetired(row, keyring)) {
          notifyRejectedSave();
          return;
        }
        await purgeDeviceContent(queryClient);
        asyncStatusRef.current = "needs-unlock";
        setLockReason("key-changed");
        setAsyncStatus("needs-unlock");
      } catch (err) {
        Sentry.captureException(err);
      } finally {
        lockingForKeyRef.current = false;
      }
    });
  }, [userId, queryClient]);

  const holdForRecoveryCode = useCallback((held: boolean) => {
    recoveryCodeHeldRef.current = held;
  }, []);

  const recheck = useCallback(() => {
    setLockReason(null);
    recordActivity();
    setAsyncStatus("loading");
    setVersion((v) => v + 1);
  }, []);

  const lock = useCallback(async () => {
    await purgeDeviceContent(queryClient);
    setAsyncStatus("needs-unlock");
  }, [queryClient]);

  useAutoLockTimer(
    autoLockEnabled && asyncStatus === "unlocked",
    autoLockMinutes,
    lock,
  );

  const finishReseal = useCallback(
    (run: number) => setResealRun((current) => (current === run ? 0 : current)),
    [],
  );
  const beginReseal = useCallback(() => setResealRun((run) => run + 1), []);

  const status: EncryptionGateStatus = authLoading
    ? "loading"
    : notApplicable
      ? "not-applicable"
      : asyncStatus;

  return {
    status,
    recheck,
    lock,
    resealDue: resealRun > 0 && status === "unlocked",
    resealRun,
    finishReseal,
    beginReseal,
    lockReason,
    holdForRecoveryCode,
  };
}
