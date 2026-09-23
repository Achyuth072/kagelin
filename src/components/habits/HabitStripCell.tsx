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
}

export function HabitStripCell({
  day,
  color,
  coarse,
  onToggle,
  habit,
  onLogValue,
  onClearValue,
}: HabitStripCellProps) {
  const { date, weekdayLabel, value, hasEntry, isToday, isBeforeStart } = day;
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

  // Square aspect ratio ensures 7 days fit narrow viewports without scrolling.
  const cellSizing = coarse
    ? "aspect-square w-full max-w-11 lg:aspect-auto lg:h-11 lg:w-11 lg:max-w-none"
    : "aspect-square w-full max-w-9 lg:aspect-auto lg:h-9 lg:w-9 lg:max-w-none";

  const weekdayHeader = (
    <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-muted-foreground">
      {weekdayLabel}
    </span>
  );

  if (isBeforeStart) {
    return (
      <div className="flex min-w-0 flex-col items-center gap-1 lg:flex-none lg:gap-1.5">
        {weekdayHeader}
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
          className="h-4 w-4"
          strokeWidth={3}
          style={{ color: getContrastingColor(color) }}
        />
      )}
      {missed && <X className="h-3.5 w-3.5" strokeWidth={3} />}
      {skipped && <Pause className="h-3 w-3" strokeWidth={3} />}
      {loggedValue !== null && (
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={filled ? { color: getContrastingColor(color) } : undefined}
        >
          {loggedValue}
        </span>
      )}
    </span>
  );

  if (isMeasurable) {
    return (
      <div className="flex min-w-0 flex-col items-center gap-1 lg:flex-none lg:gap-1.5">
        {weekdayHeader}
        <HabitQuantityPopover
          loggedValue={loggedValue}
          hasEntry={hasEntry}
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
              "group flex items-center justify-center rounded-md transition-seijaku-fast",
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
    <div className="flex min-w-0 flex-col items-center gap-1 lg:flex-none lg:gap-1.5">
      {weekdayHeader}
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
          "group flex items-center justify-center rounded-md transition-seijaku-fast",
          cellSizing,
        )}
      >
        {cellContent}
      </button>
      {liveRegion}
    </div>
  );
}
