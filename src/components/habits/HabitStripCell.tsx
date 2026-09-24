"use client";

import { Check, X, Pause } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { getContrastingColor } from "@/lib/utils/color";
import type { RollingDay } from "@/lib/utils/habit-rolling";
import { dayValue } from "@/lib/utils/habit-score";
import { entryStateName } from "@/lib/utils/habit-entry-cycle";
import { useEntryAnnouncement } from "@/lib/hooks/useEntryAnnouncement";
import {
  ENTRY_VALUE_DONE,
  ENTRY_VALUE_NOT_DONE,
  ENTRY_VALUE_SKIPPED,
  type Habit,
} from "@/lib/types/habit";
import { HabitQuantityPopover } from "./HabitQuantityPopover";

interface HabitStripCellProps {
  day: RollingDay;
  color: string;
  /** Coarse pointer requires ≥44×44 touch targets. */
  coarse: boolean;
  onToggle: (date: string) => void;
  habit?: Pick<Habit, "habit_type" | "target_type" | "target_value" | "unit">;
  /** Required for measurable habits. */
  onLogValue?: (date: string, value: number) => void;
  onClearValue?: (date: string) => void;
  header?: string;
  size?: "sm" | "default";
}

export function HabitStripCell({
  day,
  color,
  coarse,
  onToggle,
  habit,
  onLogValue,
  onClearValue,
  header = day.weekdayLabel,
  size = "default",
}: HabitStripCellProps) {
  const { date, value, hasEntry, isToday, isBeforeStart, isFuture } = day;
  const inert = isBeforeStart || isFuture;
  const isMeasurable = habit?.habit_type === "measurable";
  const stored = hasEntry ? value : null;
  const skipped = stored === ENTRY_VALUE_SKIPPED;
  const complete = !isMeasurable && stored === ENTRY_VALUE_DONE;
  const missed = !isMeasurable && stored === ENTRY_VALUE_NOT_DONE;
  const loggedValue =
    isMeasurable && stored !== null && !skipped ? stored : null;
  const filled =
    complete ||
    (loggedValue !== null &&
      habit != null &&
      dayValue(loggedValue, habit) >= 1);
  const stateText = entryStateName(stored, habit);
  const { liveRegion, onActivate } = useEntryAnnouncement(stored, stateText);

  const isCompact = size === "sm";

  // Invisible pseudo-element expands touch target to >=44px on coarse pointers.
  const cellSizing = isCompact
    ? "aspect-square h-8 w-8 sm:h-auto sm:w-full"
    : "aspect-square w-full max-w-9 lg:aspect-auto lg:h-9 lg:w-9 lg:max-w-none";

  const touchTargetClass = coarse
    ? isCompact
      ? "before:absolute before:-inset-1.5 before:content-['']"
      : "before:absolute before:-inset-1 before:content-['']"
    : "";

  const wrapperClass = cn(
    "flex min-w-0 flex-col items-center gap-1",
    isCompact ? "w-full" : "lg:flex-none lg:gap-1.5",
  );

  const headerLabel = (
    <span
      className={cn(
        "text-[10px] sm:text-[11px] font-bold uppercase tracking-wider leading-none text-muted-foreground",
        inert && "opacity-40",
      )}
    >
      {header}
    </span>
  );

  if (inert) {
    return (
      <div className={wrapperClass}>
        {headerLabel}
        <div
          aria-hidden
          className={cn("rounded-md bg-transparent", cellSizing)}
        />
      </div>
    );
  }

  const cellLabel = `${format(parseISO(date), "EEEE MMM d")}, ${stateText}${isMeasurable ? " — log amount" : ""}`;

  const cellContent = (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center rounded-md border transition-seijaku-fast",
        filled
          ? "border-transparent"
          : missed
            ? "border-destructive/50 bg-destructive/10 text-destructive"
            : skipped
              ? "border-border bg-secondary/40 text-muted-foreground"
              : "border-border bg-secondary/40 text-muted-foreground group-hover:bg-secondary",
        isToday && "ring-2 ring-offset-2 ring-offset-background",
      )}
      style={{
        ...(filled ? { backgroundColor: color } : undefined),
        ...(isToday
          ? ({ "--tw-ring-color": color } as React.CSSProperties)
          : undefined),
      }}
    >
      {complete && (
        <Check
          className={cn(isCompact ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : "h-4 w-4")}
          strokeWidth={3}
          style={{ color: getContrastingColor(color) }}
        />
      )}
      {missed && (
        <X
          className={cn(
            isCompact ? "h-3 w-3 sm:h-3.5 sm:w-3.5" : "h-3.5 w-3.5",
          )}
          strokeWidth={3}
        />
      )}
      {skipped && (
        <Pause
          className={cn(isCompact ? "h-2.5 w-2.5 sm:h-3 sm:w-3" : "h-3 w-3")}
          strokeWidth={3}
        />
      )}
      {loggedValue !== null && (
        <span
          className={cn(
            isCompact ? "text-[10px] sm:text-xs" : "text-[11px]",
            "font-semibold tabular-nums leading-none",
          )}
          style={filled ? { color: getContrastingColor(color) } : undefined}
        >
          {loggedValue}
        </span>
      )}
    </span>
  );

  if (isMeasurable) {
    return (
      <div className={wrapperClass}>
        {headerLabel}
        <HabitQuantityPopover
          stored={stored}
          unit={habit?.unit}
          targetValue={habit?.target_value}
          onLog={(amount) => onLogValue?.(date, amount)}
          onClear={() => onClearValue?.(date)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
            aria-label={cellLabel}
            title={stateText}
            className={cn(
              "group relative flex items-center justify-center rounded-md transition-seijaku-fast",
              touchTargetClass,
              cellSizing,
            )}
          >
            {cellContent}
          </button>
        </HabitQuantityPopover>
        {liveRegion}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {headerLabel}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onActivate();
          onToggle(date);
        }}
        aria-label={cellLabel}
        title={stateText}
        className={cn(
          "group relative flex items-center justify-center rounded-md transition-seijaku-fast",
          touchTargetClass,
          cellSizing,
        )}
      >
        {cellContent}
      </button>
      {liveRegion}
    </div>
  );
}
