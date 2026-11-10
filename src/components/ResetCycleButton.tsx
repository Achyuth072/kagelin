"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Square } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTimerStore } from "@/lib/store/timerStore";
import { useTimer } from "@/components/TimerProvider";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface ResetCycleButtonProps {
  className?: string;
  isPhone?: boolean;
  onStopExecuted?: () => void;
}

export function ResetCycleButton({
  className,
  isPhone = false,
  onStopExecuted,
}: ResetCycleButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const state = useTimerStore((s) => s.state);
  const totalSeconds = useTimerStore((s) => {
    const settings = s.settings;
    switch (s.state.mode) {
      case "focus":
        return settings.focusDuration * 60;
      case "shortBreak":
        return settings.shortBreakDuration * 60;
      case "longBreak":
        return settings.longBreakDuration * 60;
    }
  });

  const { stop } = useTimer();
  const { trigger } = useHaptic();

  const handleStop = () => {
    const isSessionActive =
      state.isRunning || state.remainingSeconds < totalSeconds;
    const hasProgress = state.completedSessions > 0 || isSessionActive;

    if (hasProgress) {
      setConfirmOpen(true);
    } else {
      stop();
      onStopExecuted?.();
    }
  };

  const executeStop = () => {
    stop();
    onStopExecuted?.();
    setConfirmOpen(false);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            className={cn(
              "h-12 w-12 rounded-full border border-border/80 bg-background/50 hover:bg-accent hover:text-accent-foreground flex items-center justify-center transition-seijaku active:scale-95 text-muted-foreground hover:text-foreground cursor-pointer",
              className,
            )}
            onTapStart={() => trigger("thud")}
            whileTap={isPhone ? { scale: 0.95 } : {}}
            onClick={handleStop}
            aria-label="Reset timer and cycle"
          >
            <Square className="h-5 w-5" strokeWidth={2.25} />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="top">Reset timer and cycle</TooltipContent>
      </Tooltip>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset timer and cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              Reset all completed sessions and restart cycle? This will wipe
              your multi-session progress. To abort only the active interval
              while preserving your completed sessions, use Cancel session
              instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep progress</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={executeStop}>
              Reset cycle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
