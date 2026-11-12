"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useTimer } from "@/components/TimerProvider";
import { buttonVariants, Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, SkipForward, X } from "lucide-react";
import { FocusSettingsDialog } from "@/components/FocusSettingsDialog";
import { FocusTaskPicker } from "@/components/FocusTaskPicker";
import { FocusSubtaskList } from "@/components/FocusSubtaskList";
import { FocusSyncIndicator } from "@/components/FocusSyncIndicator";
import { StopSessionButton } from "@/components/StopSessionButton";
import { FullscreenToggle } from "@/components/FullscreenToggle";
import type { TimerMode } from "@/lib/types/timer";
import { cn } from "@/lib/utils";
import { AnimatedCountdown } from "@/components/ui/animated-countdown";
import { useAnchoredBack } from "@/lib/hooks/useBackAnchor";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useTimerStore } from "@/lib/store/timerStore";
import { usePiP } from "@/components/providers/PiPProvider";
import { useFullscreen } from "@/lib/hooks/useFullscreen";
import { Minimize2, Target, PictureInPicture2 } from "lucide-react";
import { useTodayFocusSessions } from "@/lib/hooks/useTodayFocusSessions";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { useEffect } from "react";
import { ResetCycleButton } from "@/components/ResetCycleButton";

const MODE_LABELS: Record<TimerMode, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const sideControlCls = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "h-14 w-14 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 active:bg-accent/50 transition-seijaku cursor-pointer",
);

export default function FocusPage() {
  const anchoredBack = useAnchoredBack();
  const { state, settings, start, pause, skip } = useTimer();
  const { trigger, isPhone } = useHaptic();
  const { isPiPSupported, isPiPActive, openPiP, closePiP } = usePiP();
  const { isFullscreen } = useFullscreen();
  const prefersReducedMotion = usePrefersReducedMotion();
  // Sourced from the server focus_logs so every device shows the same count.
  const { data: todaySessionsCount = 0 } = useTodayFocusSessions();

  // Auto-starts only on an explicit "play focus" intent; plain navigation must never auto-start.
  useEffect(() => {
    if (useTimerStore.getState().consumeFocusStart()) {
      start();
    }
  }, [start]);

  const totalSeconds =
    {
      focus: settings.focusDuration,
      shortBreak: settings.shortBreakDuration,
      longBreak: settings.longBreakDuration,
    }[state.mode] * 60;

  const progress =
    ((totalSeconds - state.remainingSeconds) / totalSeconds) * 100;

  const handlePlayPause = () => {
    if (state.isRunning) {
      pause();
    } else {
      start();
    }
  };

  const handlePiP = async () => {
    trigger("toggle");
    if (isPiPActive) {
      closePiP();
    } else {
      await openPiP(320, 280);
    }
  };

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "flex flex-col items-center justify-center p-6 bg-background relative select-none cursor-default overflow-y-auto",
        isFullscreen && isPhone
          ? "fixed inset-0 z-50 bg-background"
          : "absolute inset-0",
      )}
    >
      <m.button
        onClick={anchoredBack}
        onTapStart={() => trigger("thud")}
        whileTap={!prefersReducedMotion && isPhone ? { scale: 0.95 } : {}}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "absolute top-4 left-4 h-14 w-14 rounded-full active:scale-95 transition-seijaku cursor-pointer",
        )}
      >
        <X className="h-6 w-6" strokeWidth={2.25} />
      </m.button>

      {isPiPSupported && !isPhone && (
        <m.button
          onClick={handlePiP}
          onTapStart={() => trigger("thud")}
          whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "absolute bottom-4 left-4 h-14 w-14 rounded-full active:scale-95 transition-seijaku cursor-pointer",
          )}
          title={
            isPiPActive ? "Close Picture-in-Picture" : "Open Picture-in-Picture"
          }
        >
          <PictureInPicture2 className="h-6 w-6" strokeWidth={2.25} />
        </m.button>
      )}

      <FullscreenToggle />

      <AnimatePresence mode="wait">
        {!isPiPActive ? (
          <m.div
            key="timer-content"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }
            }
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            className="flex flex-col items-center text-center"
          >
            <div className="type-ui font-medium uppercase tracking-widest text-muted-foreground/80">
              {MODE_LABELS[state.mode]}
            </div>

            <div className="mt-2">
              <FocusSyncIndicator />
            </div>

            <FocusTaskPicker />
            <FocusSubtaskList />

            <div className="text-7xl sm:text-8xl md:text-[10rem] font-extralight font-mono tracking-tighter text-foreground tabular-nums mt-6 leading-none">
              <AnimatedCountdown seconds={state.remainingSeconds} />
            </div>

            <div className="w-full max-w-[240px] mt-12 mb-6">
              <Progress value={progress} className="h-0.5 opacity-40" />
            </div>

            <div className="flex flex-col items-center gap-2 mb-10">
              <p className="type-ui text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {state.mode === "focus"
                  ? `Session ${state.completedSessions + 1} of ${
                      settings.sessionsBeforeLongBreak
                    }`
                  : state.mode === "longBreak"
                    ? "Cycle Complete"
                    : `Break after Session ${state.completedSessions}`}
              </p>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/30 border border-secondary/50">
                <Target className="h-3 w-3 text-primary" strokeWidth={2.25} />
                <span className="type-ui text-[10px] font-semibold text-primary/90">
                  {todaySessionsCount} TODAY
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <StopSessionButton
                className={sideControlCls}
                isPhone={isPhone}
                onStopExecuted={() => {
                  if (isPiPActive) closePiP();
                }}
              />

              <m.button
                className={cn(
                  buttonVariants({ variant: "default", size: "icon" }),
                  "h-20 w-20 rounded-full transition-seijaku hover:scale-105 active:scale-95 active:opacity-90 cursor-pointer",
                )}
                onTapStart={() => trigger("thud")}
                whileTap={
                  !prefersReducedMotion && isPhone ? { scale: 0.95 } : {}
                }
                onClick={handlePlayPause}
              >
                {state.isRunning ? (
                  <Pause className="h-8 w-8" strokeWidth={2.25} />
                ) : (
                  <Play className="h-8 w-8 ml-0.5" strokeWidth={2.25} />
                )}
              </m.button>

              <m.button
                className={sideControlCls}
                onTapStart={() => trigger("thud")}
                whileTap={
                  !prefersReducedMotion && isPhone ? { scale: 0.95 } : {}
                }
                onClick={skip}
              >
                <SkipForward className="h-5 w-5" strokeWidth={2.25} />
              </m.button>
            </div>

            <ResetCycleButton
              onResetExecuted={() => {
                if (isPiPActive) closePiP();
              }}
            />

            <div className="mt-16">
              <FocusSettingsDialog />
            </div>
          </m.div>
        ) : (
          <m.div
            key="pip-active-indicator"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }
            }
            animate={{ opacity: 1, scale: 1 }}
            exit={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }
            }
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            className="flex flex-col items-center justify-center text-center py-12"
          >
            <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
              <Minimize2
                className="h-10 w-10 text-primary animate-pulse motion-reduce:animate-none"
                strokeWidth={2.25}
              />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">
              Viewing in PiP
            </h2>
            <p className="text-muted-foreground max-w-[280px]">
              The timer is running in a floating window. You can browse other
              pages in Kagelin.
            </p>
            <Button
              variant="outline"
              className="mt-8 rounded-full px-6"
              onClick={closePiP}
            >
              Return to main view
            </Button>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
