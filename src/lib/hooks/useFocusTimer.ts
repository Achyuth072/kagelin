"use client";

import { useEffect, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { focusMutations } from "@/lib/mutations/focus";
import { useUiStore } from "@/lib/store/uiStore";
import { useFocusHistoryStore } from "@/lib/store/focusHistoryStore";
import { useAuth } from "@/components/AuthProvider";
import { useFocusSounds } from "@/lib/hooks/useFocusSounds";
import { usePathname } from "next/navigation";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { toast } from "sonner";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useTimerStore } from "@/lib/store/timerStore";
import { useTimerSync } from "@/lib/hooks/useTimerSync";
import { TimerState } from "@/lib/types/timer";

type TimerCompleteEvent = CustomEvent<{
  prevState: TimerState;
  nextState: TimerState;
  options?: {
    skipLog?: boolean;
    skipToast?: boolean;
    skipNotification?: boolean;
  };
}>;

export function useFocusTimer() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { showNotification } = usePushNotifications();
  const { isGuestMode } = useAuth();
  const { play } = useFocusSounds();
  const { trigger } = useHaptic();

  const {
    state,
    settings,
    isLoaded,
    start: storeStart,
    pause: storePause,
    stop: storeStop,
    cancel: storeCancel,
    skip: storeSkip,
    tick,
    reconcile,
    updateSettings: storeUpdateSettings,
    setLoaded,
  } = useTimerStore();

  const { upsertTimerState, claimTimerCompletion } = useTimerSync();

  const syncToServer = useCallback(async () => {
    await upsertTimerState();
  }, [upsertTimerState]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoaded(true);
    }
  }, [setLoaded]);

  const { mutate: logFocusSessionMutation } = useMutation({
    mutationKey: ["logFocusSession"],
    mutationFn: focusMutations.logSession,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["stats-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["today-focus-count"] });
    },
  });

  useEffect(() => {
    const handleComplete = async (event: Event) => {
      const customEvent = event as TimerCompleteEvent;
      const { prevState, nextState, options } = customEvent.detail;

      // Claim writes to the DB only if no other device beat us to it; the loser
      // skips side-effects and mirrors via realtime, so the session is never
      // double-logged. prevState.endsAt is the deadline that just passed.
      if (prevState.endsAt != null) {
        try {
          const won = await claimTimerCompletion(prevState.endsAt);
          if (!won) return;
        } catch (err) {
          // Can't confirm the claim — fail open and log/notify locally. A rare
          // double-log beats silently dropping the completed session.
          console.warn(
            "Timer completion claim failed; proceeding locally:",
            err,
          );
        }
      } else {
        // No deadline to claim against (deploy transient / edge) — just persist.
        try {
          await syncToServer();
        } catch (err) {
          console.warn(
            "Timer completion sync failed; proceeding locally:",
            err,
          );
        }
      }

      if (!options?.skipLog && prevState.mode === "focus") {
        if (prevState.activeTaskId) {
          logFocusSessionMutation({
            task_id: prevState.activeTaskId,
            durationSeconds: settings.focusDuration * 60,
          });
        }
        useFocusHistoryStore.getState().addSession({
          taskId: prevState.activeTaskId,
          duration: settings.focusDuration * 60,
          completedAt: new Date().toISOString(),
        });
      }

      if (prevState.mode === "focus") {
        play("sessionComplete");
      } else {
        play("breakEnd");
      }
      trigger("thud");

      const title =
        prevState.mode === "focus"
          ? "Focus session completed"
          : "Break completed";

      const description =
        nextState.isRunning && nextState.mode !== prevState.mode
          ? `Automatically started ${
              nextState.mode === "shortBreak" ? "short break" : "focus"
            }`
          : "The timer is ready for your next session.";

      if (!options?.skipToast && !document.hidden) {
        const isPipActive = useUiStore.getState().isPipActive;
        const isOnFocusPage = pathname === "/focus";

        if (!isOnFocusPage && !isPipActive) {
          toast(title, {
            description,
            duration: 4000,
            icon: null,
          });
        }
      }

      if (!options?.skipNotification) {
        const isPipActive = useUiStore.getState().isPipActive;
        const isOnFocusPage = pathname === "/focus";

        if (document.hidden || (!isOnFocusPage && !isPipActive)) {
          showNotification(
            prevState.mode === "focus" ? "Focus Complete" : "Break Complete",
            {
              body:
                prevState.mode === "focus"
                  ? "Your focus session is complete. Take a break!"
                  : "Your break is over. Time to focus!",
              // Matches the queued push's tag so they replace, not stack.
              tag: "timer_end",
              renotify: true,
            } as NotificationOptions,
          );
        }
      }
    };

    window.addEventListener("timer-complete", handleComplete);
    return () => window.removeEventListener("timer-complete", handleComplete);
  }, [
    logFocusSessionMutation,
    settings.focusDuration,
    play,
    trigger,
    pathname,
    showNotification,
    syncToServer,
    claimTimerCompletion,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reconcile();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    reconcile();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reconcile]);

  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(() => {
        const currentSeconds = useTimerStore.getState().state.remainingSeconds;

        if (currentSeconds === 61) {
          const currentMode = useTimerStore.getState().state.mode;
          if (currentMode === "focus") {
            play("sessionWarning");
          } else {
            play("breakWarning");
          }
        }

        tick();
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isRunning, tick, play]);

  const start = useCallback(
    async (taskId?: string) => {
      play("focusStart");
      storeStart(taskId);
      syncToServer();
    },
    [play, storeStart, syncToServer],
  );

  const pause = useCallback(() => {
    storePause();
    syncToServer();
  }, [storePause, syncToServer]);

  const stop = useCallback(() => {
    storeStop();
    syncToServer();
  }, [storeStop, syncToServer]);

  const cancel = useCallback(() => {
    storeCancel();
    syncToServer();
  }, [storeCancel, syncToServer]);

  // Settings are per-account: propagate so other devices agree on them.
  const updateSettings = useCallback(
    (newSettings: Parameters<typeof storeUpdateSettings>[0]) => {
      storeUpdateSettings(newSettings);
      syncToServer();
    },
    [storeUpdateSettings, syncToServer],
  );

  // Handles reopening the PWA with a timer already running.
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (hasSyncedRef.current) return;
    if (!isGuestMode && state.isRunning) {
      syncToServer();
    }
    hasSyncedRef.current = true;
  }, [isGuestMode, state.isRunning, syncToServer]);

  return {
    state,
    settings,
    isLoaded,
    start,
    pause,
    stop,
    cancel,
    // storeSkip dispatches timer-complete synchronously; the handler persists
    // the new state (claim or sync), which re-fires the server-side chain
    // projection — no wrapper needed beyond the stable store action itself.
    skip: storeSkip,
    updateSettings,
  };
}
