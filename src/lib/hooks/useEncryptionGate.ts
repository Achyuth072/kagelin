"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { getEncryptionKeyRow } from "@/lib/crypto/keyManager";
import type { EncryptionKeyRow } from "@/lib/crypto/encryptionKeyRowCache";
import { keyStore } from "@/lib/crypto/keyStore";
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

export function useEncryptionGate(): {
  status: EncryptionGateStatus;
  recheck: () => void;
  lock: () => Promise<void>;
} {
  const { user, loading: authLoading, isGuestMode } = useAuth();
  const queryClient = useQueryClient();
  const [asyncStatus, setAsyncStatus] = useState<AsyncStatus>("loading");
  const [version, setVersion] = useState(0);
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

  useEffect(() => {
    if (authLoading || notApplicable || !user) return;

    let cancelled = false;

    (async () => {
      try {
        const [row, cachedKey] = await Promise.all([
          getEncryptionKeyRow(user.id),
          keyStore.load(user.id),
        ]);
        if (cancelled) return;

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

        setAsyncStatus(resolveStatus(row, cachedKey));
      } catch {
        if (!cancelled) setAsyncStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, notApplicable, version, queryClient]);

  const recheck = useCallback(() => {
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

  const status: EncryptionGateStatus = authLoading
    ? "loading"
    : notApplicable
      ? "not-applicable"
      : asyncStatus;

  return { status, recheck, lock };
}
