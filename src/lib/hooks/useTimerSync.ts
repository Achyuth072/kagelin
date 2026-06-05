"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useTimerStore } from "@/lib/store/timerStore";
import { useUiStore } from "@/lib/store/uiStore";
import { focusMutations } from "@/lib/mutations/focus";
import { getDeviceId } from "@/lib/store/deviceId";
import { computeOffset, setServerOffset } from "@/lib/store/serverClock";
import type { TimerMode, TimerState, TimerSettings } from "@/lib/types/timer";
import { toast } from "sonner";

const VALID_MODES: TimerMode[] = ["focus", "shortBreak", "longBreak"];

function parseMode(raw: unknown, fallback: TimerMode): TimerMode {
  if (typeof raw === "string" && VALID_MODES.includes(raw as TimerMode)) {
    return raw as TimerMode;
  }
  return fallback;
}

/**
 * remoteRowToState — map a user_timer_state row onto the local TimerState.
 *
 * A running row carries an absolute `ends_at`; the receiver mirrors that
 * deadline and ticks toward it. A paused/idle row carries `remaining_seconds`
 * with `ends_at = null`. The row is applied verbatim — never reconciled against
 * the receiver's local clock — so a freshly-applied snapshot can't spuriously
 * complete or auto-start.
 */
export function remoteRowToState(
  remote: Record<string, unknown>,
  current: TimerState,
): TimerState {
  return {
    ...current,
    mode: parseMode(remote.mode, current.mode),
    remainingSeconds:
      typeof remote.remaining_seconds === "number"
        ? remote.remaining_seconds
        : current.remainingSeconds,
    isRunning:
      typeof remote.is_running === "boolean"
        ? remote.is_running
        : current.isRunning,
    activeTaskId:
      typeof remote.active_task_id === "string" ? remote.active_task_id : null,
    completedSessions:
      typeof remote.completed_sessions === "number"
        ? remote.completed_sessions
        : current.completedSessions,
    endsAt:
      typeof remote.ends_at === "string" ? Date.parse(remote.ends_at) : null,
    sourceDeviceId:
      typeof remote.source_device_id === "string"
        ? remote.source_device_id
        : null,
  };
}

/**
 * remoteRowToSettings — merge synced focus settings (duration, auto-start,
 * sessions-before-long-break) from the row so every device agrees on durations,
 * progress, and session labels. Falls back to the local settings for older rows
 * with no synced settings.
 */
export function remoteRowToSettings(
  remote: Record<string, unknown>,
  current: TimerSettings,
): TimerSettings {
  if (remote.settings && typeof remote.settings === "object") {
    return { ...current, ...(remote.settings as Partial<TimerSettings>) };
  }
  return current;
}

/**
 * useTimerSync — Real-time timer sync via Supabase postgres_changes.
 *
 * Mirrors the user_timer_state row onto the local Zustand store using the
 * server-anchored deadline model: an initial SELECT hydrates the live state on
 * subscribe, realtime UPDATEs are applied verbatim, self-originating echoes are
 * dropped by `source_device_id`, and a server-time offset is probed on connect
 * and on visibility so deadlines agree across devices.
 *
 * Returns { upsertTimerState } for useFocusTimer to call after every
 * local state transition.
 */
export function useTimerSync() {
  const { user, isGuestMode } = useAuth();
  const supabase = createClient();

  // Stale guard: highest seen updated_at from remote updates
  const lastKnownUpdatedAt = useRef<string | null>(null);

  /**
   * upsertTimerState — Persists current timer state to the DB.
   * Must be called after every local state transition (start/pause/stop/cancel).
   * Stamps source_device_id so this device's realtime echo is dropped.
   */
  const upsertTimerState = useCallback(async () => {
    const currentState = useTimerStore.getState().state;
    if (!user) return;

    await focusMutations.upsertTimerState({
      user_id: user.id,
      mode: currentState.mode,
      remaining_seconds: currentState.remainingSeconds,
      is_running: currentState.isRunning,
      active_task_id: currentState.activeTaskId,
      ends_at: currentState.endsAt
        ? new Date(currentState.endsAt).toISOString()
        : null,
      source_device_id: getDeviceId(),
      completed_sessions: currentState.completedSessions,
      settings: useTimerStore.getState().settings,
      updated_at: new Date().toISOString(),
    });
  }, [user]);

  /**
   * claimTimerCompletion — atomically complete the session whose deadline just
   * passed. Writes the current (already-advanced) local state to the DB only if
   * the row still shows that running session. Returns whether this device won;
   * the loser must skip completion side-effects and mirror via realtime.
   */
  const claimTimerCompletion = useCallback(
    async (prevEndsAt: number): Promise<boolean> => {
      if (!user) return true;
      const { state, settings } = useTimerStore.getState();
      return focusMutations.claimTimerCompletion({
        user_id: user.id,
        mode: state.mode,
        remaining_seconds: state.remainingSeconds,
        is_running: state.isRunning,
        active_task_id: state.activeTaskId,
        ends_at: state.endsAt ? new Date(state.endsAt).toISOString() : null,
        source_device_id: getDeviceId(),
        completed_sessions: state.completedSessions,
        settings,
        claim_ends_at: new Date(prevEndsAt).toISOString(),
      });
    },
    [user],
  );

  // Probe Postgres time once and store the RTT-corrected offset so serverNow()
  // agrees with the database even when this device's clock is wrong or has
  // jumped after sleep.
  const probeServerOffset = useCallback(async () => {
    try {
      const t0 = Date.now();
      const { data, error } = await supabase.rpc("server_now_ms");
      const t1 = Date.now();
      // PostgREST may serialize BIGINT as a string — coerce before using it.
      const serverMs = Number(data);
      if (error || !Number.isFinite(serverMs)) return;
      setServerOffset(computeOffset(serverMs, t0, t1));
    } catch {
      // Best-effort: fall back to the local clock (offset 0).
    }
  }, [supabase]);

  // Hydrate the current row on subscribe so a device opening mid-session shows
  // the live countdown immediately (postgres_changes only delivers future
  // UPDATEs). Applied verbatim, including our own row.
  const hydrate = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_timer_state")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) return;

    if (typeof data.updated_at === "string") {
      lastKnownUpdatedAt.current = data.updated_at;
    }
    const { state: current, settings: currentSettings } =
      useTimerStore.getState();
    useTimerStore.setState({
      state: remoteRowToState(data, current),
      settings: remoteRowToSettings(data, currentSettings),
    });
    useTimerStore.getState().reconcile();
  }, [user, supabase]);

  // Re-anchor the clock, then pull fresh state. Run on connect and whenever the
  // tab returns to the foreground — a backgrounded device (esp. mobile) drops the
  // realtime channel and would otherwise show stale state until the next UPDATE.
  const resync = useCallback(async () => {
    await Promise.all([probeServerOffset(), hydrate()]);
  }, [probeServerOffset, hydrate]);

  useEffect(() => {
    if (isGuestMode || !user) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const channel = supabase
      .channel(`timer-sync:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_timer_state",
          // No server-side filter: filtering on the non-PK `user_id` silently
          // drops UPDATEs (Postgres only writes PK columns to the WAL for the
          // filter to match). RLS already scopes delivery to the user's own row
          // — the proven pattern used by the tasks subscription.
        },
        (payload) => {
          const remote = payload.new as Record<string, unknown>;

          // Echo guard — skip rows this device originated (deterministic;
          // replaces the racy 500 ms window).
          if (remote.source_device_id === getDeviceId()) return;

          // Stale guard — skip if remote updated_at is older or equal (LWW).
          if (
            lastKnownUpdatedAt.current &&
            typeof remote.updated_at === "string" &&
            remote.updated_at <= lastKnownUpdatedAt.current
          )
            return;

          lastKnownUpdatedAt.current =
            typeof remote.updated_at === "string"
              ? remote.updated_at
              : new Date().toISOString();

          const { state: current, settings: currentSettings } =
            useTimerStore.getState();
          const wasRunning = current.isRunning;

          // Apply remote state verbatim — never reconcile a freshly-applied
          // snapshot against the local clock (that caused spurious completes /
          // auto-starts).
          useTimerStore.setState({
            state: remoteRowToState(remote, current),
            settings: remoteRowToSettings(remote, currentSettings),
          });

          // Subtle toast on remote pause / stop commands
          if (wasRunning && remote.is_running === false) {
            const message =
              (remote.remaining_seconds as number) === 0
                ? "Timer stopped from another device"
                : "Timer paused from another device";
            toast(message, { duration: 3000 });
          }

          useUiStore.getState().setIsSynced(true);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          useUiStore.getState().setIsSynced(true);
          resync();
        }
      });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
      useUiStore.getState().setIsSynced(false);
    };
  }, [isGuestMode, user, supabase, resync]);

  return { upsertTimerState, claimTimerCompletion };
}
