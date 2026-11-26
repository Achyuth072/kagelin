"use client";

import * as m from "motion/react-m";
import { Square } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTimerStore } from "@/lib/store/timerStore";
import { getDurationForMode } from "@/lib/types/timer";
import { useTimerActions } from "@/components/TimerProvider";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

export interface StopSessionButtonProps {
  className?: string;
  isPhone?: boolean;
  onStopExecuted?: () => void;
}

export function StopSessionButton({
  className,
  isPhone = false,
  onStopExecuted,
}: StopSessionButtonProps) {
  const { isRunning, remainingSeconds, sessionDurationSeconds } = useTimerStore(
    (s) => s.state,
  );
  const totalSeconds = useTimerStore(
    (s) =>
      s.state.sessionDurationSeconds ??
      getDurationForMode(s.state.mode, s.settings),
  );

  const { cancel } = useTimerActions();
  const { trigger } = useHaptic();

  const isSessionActive =
    isRunning ||
    sessionDurationSeconds != null ||
    remainingSeconds < totalSeconds;

  const handleStop = () => {
    if (!isSessionActive) return;
    trigger("thud");
    cancel();
    onStopExecuted?.();
    notify("Session stopped", {
      duration: 1500,
    });
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <m.button
          className={cn(
            "h-12 w-12 rounded-full hover:bg-accent hover:text-accent-foreground flex items-center justify-center transition-seijaku active:scale-95 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
            className,
            "disabled:bg-transparent",
          )}
          onTapStart={() => isSessionActive && trigger("thud")}
          whileTap={isPhone && isSessionActive ? { scale: 0.95 } : {}}
          onClick={handleStop}
          disabled={!isSessionActive}
          aria-label="Stop session"
        >
          <Square className="h-5 w-5" strokeWidth={2.25} />
        </m.button>
      </TooltipTrigger>
      <TooltipContent side="top">Stop session</TooltipContent>
    </Tooltip>
  );
}
