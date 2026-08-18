"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useTimerStore } from "@/lib/store/timerStore";
import { useUiStore } from "@/lib/store/uiStore";
import { focusMutations } from "@/lib/mutations/focus";
import type { UpsertTimerStateInput } from "@/lib/mutations/focus";
import { getDeviceId } from "@/lib/store/deviceId";
import { computeOffset, setServerOffset } from "@/lib/store/serverClock";
import type { TimerMode, TimerState, TimerSettings } from "@/lib/types/timer";
import { notify } from "@/lib/notify";

const VALID_MODES: TimerMode[] = ["focus", "shortBreak", "longBreak"];

const PROBE_MAX_ATTEMPTS = 3;
const PROBE_RETRY_DELAY_MS = 200;

function timerStateToRow(
  userId: string,
  state: TimerState,
  settings: TimerSettings,
): UpsertTimerStateInput {
  return {
    user_id: userId,
    mode: state.mode,
    remaining_seconds: state.remainingSeconds,
    is_running: state.isRunning,
    active_task_id: state.activeTaskId,
    ends_at: state.endsAt ? new Date(state.endsAt).toISOString() : null,
    source_device_id: getDeviceId(),
    completed_sessions: state.completedSessions,
    settings,
  };
}

function parseMode(raw: unknown, fallback: TimerMode): TimerMode {
  if (typeof raw === "string" && VALID_MODES.includes(raw as TimerMode)) {
    return raw as TimerMode;
  }
  return fallback;
}

// Applied verbatim without local reconciliation to prevent spurious completions or auto-starts.
function remoteRowToState(
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

function remoteRowToSettings(
  remote: Record<string, unknown>,
  current: TimerSettings,
): TimerSettings {
  if (remote.settings && typeof remote.settings === "object") {
    return { ...current, ...(remote.settings as Partial<TimerSettings>) };
  }
  return current;
}

export function useTimerSync() {
  const { user, isGuestMode } = useAuth();
  const supabase = createClient();

  const lastKnownUpdatedAt = useRef<string | null>(null);

  const upsertTimerState = useCallback(async () => {
    if (!user) return;
    const { state, settings } = useTimerStore.getState();

    await focusMutations.upsertTimerState({
      ...timerStateToRow(user.id, state, settings),
      updated_at: new Date().toISOString(),
    });
  }, [user]);

  const claimTimerCompletion = useCallback(
    async (prevEndsAt: number): Promise<boolean> => {
      if (!user) return true;
      const { state, settings } = useTimerStore.getState();
      return focusMutations.claimTimerCompletion({
        ...timerStateToRow(user.id, state, settings),
        claim_ends_at: new Date(prevEndsAt).toISOString(),
      });
    },
    [user],
  );

  // Fall back to local clock if the RPC fails so reconcile() does not stall at 00:00.
  const probeServerOffset = useCallback(async () => {
    for (let attempt = 1; attempt <= PROBE_MAX_ATTEMPTS; attempt++) {
      try {
        const t0 = Date.now();
        const { data, error } = await supabase.rpc("server_now_ms");
        const t1 = Date.now();
        // PostgREST may serialize BIGINT as a string.
        const serverMs = Number(data);
        if (!error && Number.isFinite(serverMs)) {
          setServerOffset(computeOffset(serverMs, t0, t1));
          return;
        }
      } catch {
        // Network/transport error
      }
      if (attempt < PROBE_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, PROBE_RETRY_DELAY_MS * attempt));
      }
    }
    setServerOffset(0);
  }, [supabase]);

  // Fetch initial state on connect since postgres_changes only delivers future events.
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

  // Refresh clock and state when foregrounded to recover dropped realtime connections.
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
          // Do not filter on non-PK user_id: Postgres only writes PK columns to WAL for filters. RLS scopes delivery.
        },
        (payload) => {
          const remote = payload.new as Record<string, unknown>;

          if (remote.source_device_id === getDeviceId()) return;

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

          useTimerStore.setState({
            state: remoteRowToState(remote, current),
            settings: remoteRowToSettings(remote, currentSettings),
          });

          if (wasRunning && remote.is_running === false) {
            const message =
              (remote.remaining_seconds as number) === 0
                ? "Timer stopped from another device"
                : "Timer paused from another device";
            notify(message, { duration: 3000 });
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

  return { upsertTimerState, claimTimerCompletion, hydrate };
}
