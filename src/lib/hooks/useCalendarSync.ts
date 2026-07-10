"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { runCalendarSync, runCalendarPush } from "@/lib/sync/run-sync";
import {
  canAutoSync,
  markAutoSync,
  onLocalEdit,
} from "@/lib/sync/sync-scheduler";
import { useAuth } from "@/components/AuthProvider";

const PUSH_DEBOUNCE_MS = 2500;
// Mount can fire often (in-app nav) → modest throttle. Refocus is a deliberate
// "show me fresh" signal → only dedup the focus+visibilitychange double-fire.
const MOUNT_THROTTLE_MS = 30 * 1000;
const REFOCUS_THROTTLE_MS = 3 * 1000;

/**
 * Owns calendar sync triggers (55-DESIGN → Sync Triggers):
 * - mount: full pull+push, throttled ~5 min
 * - window refocus: full, throttled ~5 min
 * - local edit: debounced push-only (~4 s after the last mutation)
 *
 * Returns `syncNow` for the manual "Sync now" button (bypasses the throttle).
 */
export function useCalendarSync() {
  const queryClient = useQueryClient();
  const { isGuestMode } = useAuth();
  const runningRef = useRef(false);

  const runFull = useCallback(
    async (opts?: { force?: boolean; throttleMs?: number }) => {
      if (isGuestMode) return;
      if (!opts?.force && !canAutoSync(opts?.throttleMs)) return;
      if (runningRef.current) return;
      runningRef.current = true;
      markAutoSync();
      try {
        await runCalendarSync();
      } finally {
        runningRef.current = false;
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        // A revoked token is deleted server-side during the sync attempt; refresh
        // the connected-providers query so the reconnect banner (#57) surfaces
        // without waiting for a manual reload.
        queryClient.invalidateQueries({
          queryKey: ["calendar-connected-providers"],
        });
      }
    },
    [isGuestMode, queryClient],
  );

  // Mount trigger
  useEffect(() => {
    runFull({ throttleMs: MOUNT_THROTTLE_MS });
  }, [runFull]);

  // Window-refocus trigger (both focus and tab-visibility)
  useEffect(() => {
    if (isGuestMode) return;
    const onFocus = () => runFull({ throttleMs: REFOCUS_THROTTLE_MS });
    const onVisible = () => {
      if (document.visibilityState === "visible")
        runFull({ throttleMs: REFOCUS_THROTTLE_MS });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isGuestMode, runFull]);

  // Debounced push-only trigger on local edits
  useEffect(() => {
    if (isGuestMode) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onLocalEdit(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          await runCalendarPush();
        } finally {
          queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        }
      }, PUSH_DEBOUNCE_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      off();
    };
  }, [isGuestMode, queryClient]);

  const syncNow = useCallback(() => runFull({ force: true }), [runFull]);

  return { syncNow };
}
