"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEIJAKU_SPRING } from "@/lib/motion";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

interface SegmentedTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  onConfirm?: () => void;
  className?: string;
  compact?: boolean;
  timeFormat?: "12h" | "24h" | "system";
}

export function SegmentedTimePicker({
  value,
  onChange,
  onConfirm,
  className,
  compact = false,
  timeFormat: timeFormatProp,
}: SegmentedTimePickerProps) {
  const { trigger } = useHaptic();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { timeFormat: defaultTimeFormat } = useTimeFormat();

  const effectiveFormat = timeFormatProp ?? defaultTimeFormat ?? "12h";

  const is24hr = useMemo(() => {
    if (effectiveFormat === "system") {
      return new Intl.DateTimeFormat(navigator.language, {
        hour: "numeric",
      })
        .formatToParts(new Date(2024, 0, 1, 14, 0))
        .some((part) => part.value === "14");
    }
    return effectiveFormat === "24h";
  }, [effectiveFormat]);

  const hours = value.getHours();
  const minutes = value.getMinutes();

  const h12 = hours % 12 || 12;
  const isPM = hours >= 12;

  const hoursInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);
  const ampmButtonRef = useRef<HTMLButtonElement>(null);
  const invalidTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const [activeSegment, setActiveSegment] = useState<"h" | "m" | "p" | null>(
    null,
  );
  const [invalidSegment, setInvalidSegment] = useState<"h" | "m" | null>(null);
  const [lastDelta, setLastDelta] = useState<number>(0);
  const [typingBuffer, setTypingBuffer] = useState("");
  const [lastTypedAt, setLastTypedAt] = useState(0);

  useEffect(() => {
    return () => clearTimeout(invalidTimerRef.current);
  }, []);

  const triggerInvalidFeedback = useCallback((segment: "h" | "m") => {
    setInvalidSegment(segment);
    clearTimeout(invalidTimerRef.current);
    invalidTimerRef.current = setTimeout(() => {
      setInvalidSegment(null);
    }, 300);
  }, []);

  const handleFocus = useCallback((segment: "h" | "m" | "p") => {
    setActiveSegment(segment);
    setTypingBuffer("");
    setLastTypedAt(0);
  }, []);

  const updateTime = useCallback(
    (hoursVal: number, min: number, pm?: boolean) => {
      const newDate = new Date(value);
      if (is24hr) {
        newDate.setHours(hoursVal);
      } else {
        let finalHours = hoursVal;
        if (pm && hoursVal !== 12) finalHours += 12;
        if (!pm && hoursVal === 12) finalHours = 0;
        newDate.setHours(finalHours);
      }
      newDate.setMinutes(min);
      newDate.setSeconds(0);
      newDate.setMilliseconds(0);

      if (newDate.getTime() !== value.getTime()) {
        onChange(newDate);
      }
    },
    [value, onChange, is24hr],
  );

  const adjustValue = useCallback(
    (segment: "h" | "m" | "p", delta: number) => {
      trigger("tick");
      setLastDelta(delta);
      if (segment === "h") {
        if (is24hr) {
          const nextH = (((hours + delta) % 24) + 24) % 24;
          updateTime(nextH, minutes);
        } else {
          const nextH = ((((h12 - 1 + delta) % 12) + 12) % 12) + 1;
          updateTime(nextH, minutes, isPM);
        }
      } else if (segment === "m") {
        const nextM = (((minutes + delta) % 60) + 60) % 60;
        updateTime(is24hr ? hours : h12, nextM, is24hr ? undefined : isPM);
      } else {
        updateTime(h12, minutes, !isPM);
      }
    },
    [h12, hours, minutes, isPM, is24hr, updateTime, trigger],
  );

  const handleInputChange = useCallback(
    (segment: "h" | "m", char: string) => {
      const digit = char.replace(/\D/g, "").slice(-1);
      if (!digit) return;

      const now = Date.now();
      const isWithinWindow =
        now - lastTypedAt < 1200 && typingBuffer.length === 1;
      const activeBuffer = isWithinWindow ? typingBuffer : "";
      const newBuffer = activeBuffer + digit;
      const digitNum = parseInt(digit, 10);
      const num = parseInt(newBuffer, 10);
      if (isNaN(num)) return;

      if (segment === "h") {
        if (is24hr) {
          if (activeBuffer === "") {
            if (digitNum >= 3) {
              setTypingBuffer("");
              setLastTypedAt(0);
              updateTime(digitNum, minutes);
              trigger("tick");
              minutesInputRef.current?.focus();
              return;
            }
            setTypingBuffer(digit);
            setLastTypedAt(now);
            updateTime(digitNum, minutes);
            trigger("tick");
            return;
          }

          if (num <= 23) {
            setTypingBuffer("");
            setLastTypedAt(0);
            updateTime(num, minutes);
            trigger("tick");
            minutesInputRef.current?.focus();
            return;
          }

          // Reject out-of-range second digit (e.g. 25) without corrupting valid value.
          setTypingBuffer("");
          setLastTypedAt(0);
          triggerInvalidFeedback("h");
          return;
        }

        // 12h Hours
        if (activeBuffer === "") {
          if (digit === "0") {
            setTypingBuffer("0");
            setLastTypedAt(now);
            return;
          }
          if (digit === "1") {
            setTypingBuffer("1");
            setLastTypedAt(now);
            updateTime(1, minutes, isPM);
            trigger("tick");
            return;
          }
          // 2-9 commits immediately and advances to Minutes
          setTypingBuffer("");
          setLastTypedAt(0);
          updateTime(digitNum, minutes, isPM);
          trigger("tick");
          minutesInputRef.current?.focus();
          return;
        }

        if (activeBuffer === "0") {
          if (digit === "0") {
            setTypingBuffer("");
            setLastTypedAt(0);
            triggerInvalidFeedback("h");
            return;
          }
          setTypingBuffer("");
          setLastTypedAt(0);
          updateTime(digitNum, minutes, isPM);
          trigger("tick");
          minutesInputRef.current?.focus();
          return;
        }

        // activeBuffer === "1"
        if (digitNum <= 2) {
          setTypingBuffer("");
          setLastTypedAt(0);
          updateTime(num, minutes, isPM);
          trigger("tick");
          minutesInputRef.current?.focus();
          return;
        }

        // 3-9 after 1: keep 01, focus Minutes, and feed digit into Minutes
        minutesInputRef.current?.focus();
        if (digitNum >= 6) {
          setTypingBuffer("");
          setLastTypedAt(0);
          updateTime(1, digitNum, isPM);
          trigger("tick");
          ampmButtonRef.current?.focus();
        } else {
          setTypingBuffer(digit);
          setLastTypedAt(now);
          updateTime(1, digitNum, isPM);
          trigger("tick");
        }
        return;
      }

      // Minutes
      const currentHours = is24hr ? hours : h12;
      if (activeBuffer === "") {
        if (digitNum >= 6) {
          setTypingBuffer("");
          setLastTypedAt(0);
          updateTime(currentHours, digitNum, is24hr ? undefined : isPM);
          trigger("tick");
          if (!is24hr) {
            ampmButtonRef.current?.focus();
          }
          return;
        }
        setTypingBuffer(digit);
        setLastTypedAt(now);
        updateTime(currentHours, digitNum, is24hr ? undefined : isPM);
        trigger("tick");
        return;
      }

      if (num <= 59) {
        setTypingBuffer("");
        setLastTypedAt(0);
        updateTime(currentHours, num, is24hr ? undefined : isPM);
        trigger("tick");
        if (!is24hr) {
          ampmButtonRef.current?.focus();
        }
        return;
      }

      setTypingBuffer("");
      setLastTypedAt(0);
      triggerInvalidFeedback("m");
    },
    [
      h12,
      hours,
      is24hr,
      isPM,
      lastTypedAt,
      minutes,
      trigger,
      triggerInvalidFeedback,
      typingBuffer,
      updateTime,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent, segment: "h" | "m" | "p") => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      const step = segment === "m" && e.shiftKey ? 15 : 1;
      adjustValue(segment, step);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const step = segment === "m" && e.shiftKey ? -15 : -1;
      adjustValue(segment, step);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      if (segment === "m") {
        hoursInputRef.current?.focus();
      } else if (segment === "p") {
        minutesInputRef.current?.focus();
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      if (segment === "h") {
        minutesInputRef.current?.focus();
      } else if (segment === "m" && !is24hr) {
        ampmButtonRef.current?.focus();
      }
    } else if (
      (e.key === "Backspace" || e.key === "Delete") &&
      (segment === "h" || segment === "m")
    ) {
      e.preventDefault();
      e.stopPropagation();
      const wasBufferEmpty = typingBuffer === "";
      setTypingBuffer("");
      setLastTypedAt(0);
      if (segment === "m") {
        if (e.key === "Backspace" && minutes === 0 && wasBufferEmpty) {
          hoursInputRef.current?.focus();
          return;
        }
        updateTime(is24hr ? hours : h12, 0, is24hr ? undefined : isPM);
      } else {
        updateTime(is24hr ? 0 : 12, minutes, is24hr ? undefined : isPM);
      }
      trigger("tick");
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).blur();
      onConfirm?.();
    } else if (e.key === "Escape") {
      (e.target as HTMLElement).blur();
    } else if (/^[0-9]$/.test(e.key) && (segment === "h" || segment === "m")) {
      e.preventDefault();
      e.stopPropagation();
      handleInputChange(segment, e.key);
    } else if (
      !is24hr &&
      (e.key.toLowerCase() === "a" || e.key.toLowerCase() === "p")
    ) {
      e.preventDefault();
      e.stopPropagation();
      const shouldBePM = e.key.toLowerCase() === "p";
      if (isPM !== shouldBePM) {
        updateTime(h12, minutes, shouldBePM);
      }
      trigger("toggle");
    }
  };

  const handleWheel = (e: React.WheelEvent, segment: "h" | "m" | "p") => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -1 : 1;
    adjustValue(segment, delta);
  };

  const [dragStart, setDragStart] = useState<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDragStart(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent, segment: "h" | "m") => {
    e.stopPropagation();
    if (dragStart === null) return;
    const delta = dragStart - e.clientY;
    if (Math.abs(delta) > 20) {
      adjustValue(segment, delta > 0 ? 1 : -1);
    }
    setDragStart(null);
  };

  const displayHours = is24hr ? hours : h12;
  const formattedHours = displayHours.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center select-none touch-none",
        compact ? "py-0" : "py-2",
        className,
      )}
      data-base-ui-swipe-ignore
    >
      <div className="flex items-center gap-1.5 md:gap-2 font-light tabular-nums tracking-tighter">
        <div className="flex items-center gap-0.5">
          {/* Hours Segment */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Increment Hours"
              onClick={(e) => {
                e.stopPropagation();
                adjustValue("h", 1);
              }}
              className="sm:hidden min-h-[36px] min-w-[36px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md"
            >
              <ChevronUp className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <div className="relative group">
              <m.div
                animate={
                  invalidSegment === "h" && !prefersReducedMotion
                    ? { x: [0, -3, 3, -2, 0] }
                    : { x: 0 }
                }
                transition={{ duration: 0.12 }}
                className={cn(
                  "relative rounded-lg transition-colors duration-150 border-2 touch-none pointer-events-none select-none",
                  compact ? "px-2 py-1" : "px-3 md:px-4 py-2",
                  activeSegment === "h"
                    ? "text-foreground bg-accent border-brand-text ring-2 ring-ring/20"
                    : "text-foreground bg-secondary border-border hover:bg-accent",
                  invalidSegment === "h" && "border-destructive",
                )}
              >
                <m.span
                  key={`h-${displayHours}`}
                  initial={{ y: lastDelta > 0 ? -2 : 2, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={
                    prefersReducedMotion ? { duration: 0 } : SEIJAKU_SPRING
                  }
                  className={cn(
                    "leading-none block font-semibold tracking-tight",
                    compact ? "text-2xl" : "text-4xl md:text-5xl",
                  )}
                >
                  {formattedHours}
                </m.span>
              </m.div>
              <input
                ref={hoursInputRef}
                type="text"
                role="spinbutton"
                inputMode="numeric"
                pattern="[0-9]*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-lg focus:outline-none"
                aria-label="Adjust Hours"
                aria-valuenow={displayHours}
                aria-valuemin={is24hr ? 0 : 1}
                aria-valuemax={is24hr ? 23 : 12}
                aria-valuetext={`${formattedHours}${is24hr ? "" : isPM ? " PM" : " AM"}`}
                data-base-ui-swipe-ignore
                onFocus={() => handleFocus("h")}
                onBlur={() => setActiveSegment(null)}
                onKeyDown={(e) => handleKeyDown(e, "h")}
                onWheelCapture={(e) => handleWheel(e, "h")}
                onPointerDown={handlePointerDown}
                onPointerUp={(e) => handlePointerUp(e, "h")}
                onChange={(e) => {
                  // Catches Android IME input when onKeyDown key is "Unidentified"
                  const digit = e.target.value.replace(/\D/g, "").slice(-1);
                  if (digit) handleInputChange("h", digit);
                  e.currentTarget.value = "";
                }}
              />
            </div>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Decrement Hours"
              onClick={(e) => {
                e.stopPropagation();
                adjustValue("h", -1);
              }}
              className="sm:hidden min-h-[36px] min-w-[36px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md"
            >
              <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>

          <span
            aria-hidden="true"
            className={cn(
              "text-muted-foreground font-thin self-center translate-y-[-1px]",
              compact ? "text-xl" : "text-2xl md:text-3xl",
            )}
          >
            :
          </span>

          {/* Minutes Segment */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Increment Minutes"
              onClick={(e) => {
                e.stopPropagation();
                adjustValue("m", 1);
              }}
              className="sm:hidden min-h-[36px] min-w-[36px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md"
            >
              <ChevronUp className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <div className="relative group">
              <m.div
                animate={
                  invalidSegment === "m" && !prefersReducedMotion
                    ? { x: [0, -3, 3, -2, 0] }
                    : { x: 0 }
                }
                transition={{ duration: 0.12 }}
                className={cn(
                  "relative rounded-lg transition-colors duration-150 border-2 touch-none pointer-events-none select-none",
                  compact ? "px-2 py-1" : "px-3 md:px-4 py-2",
                  activeSegment === "m"
                    ? "text-foreground bg-accent border-brand-text ring-2 ring-ring/20"
                    : "text-foreground bg-secondary border-border hover:bg-accent",
                  invalidSegment === "m" && "border-destructive",
                )}
              >
                <m.span
                  key={`m-${minutes}`}
                  initial={{ y: lastDelta > 0 ? -2 : 2, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={
                    prefersReducedMotion ? { duration: 0 } : SEIJAKU_SPRING
                  }
                  className={cn(
                    "leading-none block font-semibold tracking-tight",
                    compact ? "text-2xl" : "text-4xl md:text-5xl",
                  )}
                >
                  {formattedMinutes}
                </m.span>
              </m.div>
              <input
                ref={minutesInputRef}
                type="text"
                role="spinbutton"
                inputMode="numeric"
                pattern="[0-9]*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-lg focus:outline-none"
                aria-label="Adjust Minutes"
                aria-valuenow={minutes}
                aria-valuemin={0}
                aria-valuemax={59}
                aria-valuetext={`${formattedMinutes} minutes`}
                data-base-ui-swipe-ignore
                onFocus={() => handleFocus("m")}
                onBlur={() => setActiveSegment(null)}
                onKeyDown={(e) => handleKeyDown(e, "m")}
                onWheelCapture={(e) => handleWheel(e, "m")}
                onPointerDown={handlePointerDown}
                onPointerUp={(e) => handlePointerUp(e, "m")}
                onChange={(e) => {
                  const digit = e.target.value.replace(/\D/g, "").slice(-1);
                  if (digit) handleInputChange("m", digit);
                  e.currentTarget.value = "";
                }}
              />
            </div>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Decrement Minutes"
              onClick={(e) => {
                e.stopPropagation();
                adjustValue("m", -1);
              }}
              className="sm:hidden min-h-[36px] min-w-[36px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md"
            >
              <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {!is24hr && (
          <button
            ref={ampmButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              trigger("toggle");
              updateTime(h12, minutes, !isPM);
            }}
            onFocus={() => handleFocus("p")}
            onBlur={() => setActiveSegment(null)}
            onKeyDown={(e) => handleKeyDown(e, "p")}
            onWheel={(e) => handleWheel(e, "p")}
            data-base-ui-swipe-ignore
            aria-label="Toggle AM PM"
            className={cn(
              "relative flex items-center justify-center rounded-md transition-colors duration-150 outline-none uppercase font-bold tracking-[0.05em] text-[10px] self-center border touch-none bg-secondary hover:bg-accent border-border text-foreground focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-[36px]",
              compact ? "w-11" : "w-14",
              activeSegment === "p" &&
                "bg-accent border-brand-text ring-2 ring-ring/20",
            )}
          >
            <AnimatePresence mode="wait">
              <m.span
                key={isPM ? "pm" : "am"}
                initial={{ opacity: 0, y: 1 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -1 }}
                transition={{ duration: 0.12 }}
                className="absolute"
              >
                {isPM ? "PM" : "AM"}
              </m.span>
            </AnimatePresence>
          </button>
        )}
      </div>
    </div>
  );
}
