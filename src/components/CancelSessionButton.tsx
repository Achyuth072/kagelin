"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useTimerStore } from "@/lib/store/timerStore";
import { useTimerActions } from "@/components/TimerProvider";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";

// Intentionally not destructive-colored (muted text, not a button variant) —
// typography mirrors the MODE_LABELS badge in app/focus/page.tsx.
const ACTIVE_CLASSES =
  "text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70 hover:text-muted-foreground hover:underline underline-offset-4 transition-colors duration-150 cursor-pointer";

export function CancelSessionButton() {
  const { isRunning, remainingSeconds } = useTimerStore((state) => state.state);
  const totalSeconds = useTimerStore((state) => {
    const settings = state.settings;
    const mode = state.state.mode;
    switch (mode) {
      case "focus":
        return settings.focusDuration * 60;
      case "shortBreak":
        return settings.shortBreakDuration * 60;
      case "longBreak":
        return settings.longBreakDuration * 60;
    }
  });
  const { cancel } = useTimerActions();
  const { trigger } = useHaptic();

  const handleClick = useCallback(() => {
    trigger("tick");
    cancel();
    toast("Session cancelled", {
      duration: 1500,
    });
  }, [cancel, trigger]);

  const isSessionActive = isRunning || remainingSeconds < totalSeconds;

  if (!isSessionActive) return null;

  return (
    <div className="py-4 flex justify-center">
      <button
        onClick={handleClick}
        className={cn(
          ACTIVE_CLASSES,
          "transition-opacity duration-300 cursor-pointer",
        )}
        type="button"
      >
        Cancel session
      </button>
    </div>
  );
}
