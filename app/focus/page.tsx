"use client";

import * as m from "motion/react-m";
import { useTimer } from "@/components/TimerProvider";
import { buttonVariants, Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { Play, Pause, SkipForward, X } from "lucide-react";
import { FocusSettingsDialog } from "@/components/FocusSettingsDialog";
import { FocusTaskPicker } from "@/components/FocusTaskPicker";
import { FocusSubtaskList } from "@/components/FocusSubtaskList";
import { FocusSyncIndicator } from "@/components/FocusSyncIndicator";
import { StopSessionButton } from "@/components/StopSessionButton";
import { FullscreenToggle } from "@/components/FullscreenToggle";
import type { TimerMode, TimerState } from "@/lib/types/timer";
import { getDurationForMode } from "@/lib/types/timer";
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
import { useEffect, useRef, useState } from "react";
import { ResetCycleButton } from "@/components/ResetCycleButton";
import { notify } from "@/lib/notify";

const MODE_LABELS: Record<TimerMode, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const sideControlCls = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "h-14 w-14 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 active:bg-accent transition-seijaku cursor-pointer disabled:bg-transparent",
);

export default function FocusPage() {
  const anchoredBack = useAnchoredBack();
  const { state, settings, start, pause, cancel, skip } = useTimer();
  const { trigger, isPhone } = useHaptic();
  const { isPiPSupported, isPiPActive, openPiP, closePiP } = usePiP();
  const { isFullscreen } = useFullscreen();
  const prefersReducedMotion = usePrefersReducedMotion();
  // Sourced from the server focus_logs so every device shows the same count.
  const { data: todaySessionsCount = 0 } = useTodayFocusSessions();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  // Auto-starts only on an explicit "play focus" intent; plain navigation must never auto-start.
  useEffect(() => {
    if (useTimerStore.getState().consumeFocusStart()) {
      start();
    }
  }, [start]);

  const totalSeconds =
    state.sessionDurationSeconds ?? getDurationForMode(state.mode, settings);

  const progress =
    totalSeconds > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((totalSeconds - state.remainingSeconds) / totalSeconds) * 100,
          ),
        )
      : 0;

  const isPausedMidSession =
    !state.isRunning &&
    (state.sessionDurationSeconds != null ||
      state.remainingSeconds < totalSeconds);

  const isSessionActive = state.isRunning || isPausedMidSession;

  const handlePlayPause = () => {
    if (state.isRunning) {
      pause();
    } else {
      start();
    }
  };

  // Quiet milestone announcements for screen readers (never on 1s ticks).
  const prevRunningRef = useRef(state.isRunning);
  const announcedMilestoneRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.isRunning && !prevRunningRef.current) {
      setLiveAnnouncement(`${MODE_LABELS[state.mode]} started`);
      announcedMilestoneRef.current = null;
    } else if (
      !state.isRunning &&
      prevRunningRef.current &&
      isPausedMidSession
    ) {
      setLiveAnnouncement("Timer paused");
    }
    prevRunningRef.current = state.isRunning;
  }, [state.isRunning, state.mode, isPausedMidSession]);

  useEffect(() => {
    if (!state.isRunning) return;
    if (
      totalSeconds > 300 &&
      state.remainingSeconds === 300 &&
      announcedMilestoneRef.current !== 300
    ) {
      announcedMilestoneRef.current = 300;
      setLiveAnnouncement("5 minutes remaining");
    } else if (
      state.remainingSeconds === 60 &&
      announcedMilestoneRef.current !== 60
    ) {
      announcedMilestoneRef.current = 60;
      setLiveAnnouncement("1 minute remaining");
    }
  }, [state.isRunning, state.remainingSeconds, totalSeconds]);

  useEffect(() => {
    const onComplete = (event: Event) => {
      const custom = event as CustomEvent<{ prevState: TimerState }>;
      const prevMode = custom.detail?.prevState?.mode ?? state.mode;
      setLiveAnnouncement(
        prevMode === "focus" ? "Focus session completed" : "Break completed",
      );
      announcedMilestoneRef.current = null;
    };
    window.addEventListener("timer-complete", onComplete);
    return () => window.removeEventListener("timer-complete", onComplete);
  }, [state.mode]);

  // Focus page keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (
        settingsOpen ||
        stopConfirmOpen ||
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]',
        )
      ) {
        return;
      }

      if (e.code === "Space" || e.key === " ") {
        const active = document.activeElement;
        if (
          active instanceof HTMLElement &&
          (active.tagName === "BUTTON" ||
            active.getAttribute("role") === "button")
        ) {
          return;
        }
        e.preventDefault();
        if (state.isRunning) {
          pause();
        } else {
          start();
        }
        return;
      }

      if (e.key.toLowerCase() === "s" && !e.shiftKey) {
        e.preventDefault();
        skip();
        return;
      }

      if (e.key.toLowerCase() === "r" && e.shiftKey && isSessionActive) {
        e.preventDefault();
        setStopConfirmOpen(true);
        return;
      }

      if (e.key === "," && !e.shiftKey) {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    settingsOpen,
    stopConfirmOpen,
    state.isRunning,
    isSessionActive,
    start,
    pause,
    skip,
  ]);

  const handleConfirmStop = () => {
    trigger("thud");
    cancel();
    if (isPiPActive) closePiP();
    setStopConfirmOpen(false);
    notify("Session stopped", { duration: 1500 });
  };

  const handlePiP = async () => {
    trigger("toggle");
    if (isPiPActive) {
      closePiP();
    } else {
      await openPiP(320, 280);
    }
  };

  const chromeDimCls = state.isRunning
    ? "opacity-50 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
    : "transition-opacity duration-200";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 bg-background relative select-none cursor-default overflow-y-auto",
        isFullscreen && isPhone
          ? "fixed inset-0 z-50 bg-background"
          : "absolute inset-0",
      )}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <m.button
        onClick={anchoredBack}
        aria-label="Exit focus mode"
        onTapStart={() => trigger("thud")}
        whileTap={!prefersReducedMotion && isPhone ? { scale: 0.95 } : {}}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "absolute top-4 left-4 h-14 w-14 rounded-full active:scale-95 transition-seijaku cursor-pointer",
          chromeDimCls,
        )}
      >
        <X className="h-6 w-6" strokeWidth={2.25} />
      </m.button>

      {isPiPSupported && !isPhone && (
        <m.button
          onClick={handlePiP}
          aria-label={
            isPiPActive ? "Close Picture-in-Picture" : "Open Picture-in-Picture"
          }
          onTapStart={() => trigger("thud")}
          whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "absolute bottom-4 left-4 h-14 w-14 rounded-full active:scale-95 transition-seijaku cursor-pointer",
            chromeDimCls,
          )}
          title={
            isPiPActive ? "Close Picture-in-Picture" : "Open Picture-in-Picture"
          }
        >
          <PictureInPicture2 className="h-6 w-6" strokeWidth={2.25} />
        </m.button>
      )}

      <FullscreenToggle />

      {!isPiPActive ? (
        <div
          key="timer-content"
          className="flex flex-col items-center text-center"
        >
          <div className="flex items-center justify-center gap-2">
            <h1 className="type-ui font-medium uppercase tracking-widest text-muted-foreground">
              {MODE_LABELS[state.mode]}
            </h1>
            {isPausedMidSession && (
              <span className="bg-muted border border-border text-muted-foreground font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-md">
                PAUSED
              </span>
            )}
          </div>

          <div className={cn("mt-2", chromeDimCls)}>
            <FocusSyncIndicator />
          </div>

          <div className={chromeDimCls}>
            <FocusTaskPicker />
            <FocusSubtaskList />
          </div>

          <div
            role="timer"
            aria-label={`${MODE_LABELS[state.mode]} timer, ${Math.floor(state.remainingSeconds / 60)} minutes ${state.remainingSeconds % 60} seconds remaining`}
            className={cn(
              "text-7xl sm:text-8xl md:text-[10rem] font-extralight font-mono tracking-tighter text-foreground tabular-nums mt-6 leading-none transition-opacity duration-200",
              isPausedMidSession && "opacity-75",
            )}
          >
            <AnimatedCountdown
              seconds={state.remainingSeconds}
              isRunning={state.isRunning}
            />
          </div>

          <div className="w-full max-w-[240px] mt-12 mb-6">
            <Progress
              value={progress}
              className="h-[3px] opacity-100 bg-muted"
              indicatorClassName={
                isPausedMidSession ? "bg-muted-foreground" : "bg-brand"
              }
            />
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

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary border border-border">
              <Target className="h-3 w-3 text-primary" strokeWidth={2.25} />
              <span className="type-ui text-[10px] font-semibold text-primary">
                {todaySessionsCount} TODAY
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <StopSessionButton
              className={cn(sideControlCls, chromeDimCls)}
              isPhone={isPhone}
              onStopExecuted={() => {
                if (isPiPActive) closePiP();
              }}
            />

            <m.button
              className={cn(
                buttonVariants({
                  variant: state.isRunning ? "outline" : "default",
                  size: "icon",
                }),
                "h-20 w-20 rounded-full transition-seijaku hover:scale-105 active:scale-95 cursor-pointer",
                state.isRunning
                  ? "bg-card border border-border-strong text-foreground hover:bg-accent"
                  : "bg-brand text-brand-foreground hover:bg-brand",
              )}
              aria-label={state.isRunning ? "Pause timer" : "Start timer"}
              onTapStart={() => trigger("thud")}
              whileTap={!prefersReducedMotion && isPhone ? { scale: 0.95 } : {}}
              onClick={handlePlayPause}
            >
              {state.isRunning ? (
                <Pause className="h-8 w-8" strokeWidth={2.25} />
              ) : (
                <Play className="h-8 w-8 ml-0.5" strokeWidth={2.25} />
              )}
            </m.button>

            <m.button
              className={cn(sideControlCls, chromeDimCls)}
              aria-label="Skip session"
              onTapStart={() => trigger("thud")}
              whileTap={!prefersReducedMotion && isPhone ? { scale: 0.95 } : {}}
              onClick={skip}
            >
              <SkipForward className="h-5 w-5" strokeWidth={2.25} />
            </m.button>
          </div>

          {!state.isRunning && !isPausedMidSession && (
            <p className="hidden md:block mt-4 font-mono text-[11px] text-muted-foreground">
              Space to start
            </p>
          )}

          <div className={chromeDimCls}>
            <ResetCycleButton
              onResetExecuted={() => {
                if (isPiPActive) closePiP();
              }}
            />
          </div>

          <div className={cn("mt-16", chromeDimCls)}>
            <FocusSettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
            />
          </div>
        </div>
      ) : (
        <div
          key="pip-active-indicator"
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
        </div>
      )}

      <AlertDialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop focus session?</AlertDialogTitle>
            <AlertDialogDescription>
              End the current session and return the timer to idle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmStop}
            >
              Stop session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
