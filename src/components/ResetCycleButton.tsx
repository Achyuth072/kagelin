"use client";

import { useState } from "react";
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
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

export interface ResetCycleButtonProps {
  className?: string;
  onResetExecuted?: () => void;
}

const ACTIVE_CLASSES =
  "text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70 hover:text-muted-foreground hover:underline underline-offset-4 transition-colors duration-150 cursor-pointer";

export function ResetCycleButton({
  className,
  onResetExecuted,
}: ResetCycleButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const completedSessions = useTimerStore((s) => s.state.completedSessions);
  const mode = useTimerStore((s) => s.state.mode);

  const { stop } = useTimer();
  const { trigger } = useHaptic();

  const hasCycleProgress = completedSessions > 0 || mode === "longBreak";

  const handleReset = () => {
    trigger("thud");
    stop();
    onResetExecuted?.();
    setConfirmOpen(false);
    notify("Cycle reset", {
      duration: 1500,
    });
  };

  return (
    <>
      <div className="h-12 flex items-center justify-center">
        {hasCycleProgress && (
          <button
            onClick={() => setConfirmOpen(true)}
            className={cn(ACTIVE_CLASSES, className)}
            type="button"
            aria-label="Reset cycle (starts from Session 1)"
          >
            Reset cycle
          </button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset focus cycle?</AlertDialogTitle>
            <AlertDialogDescription>
              Reset all completed sessions and start a new cycle from Session 1?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep progress</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleReset}>
              Reset cycle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
