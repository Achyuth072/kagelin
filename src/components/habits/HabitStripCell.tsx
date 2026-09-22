"use client";

import { Check, X, Pause } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { getContrastingColor } from "@/lib/utils/color";
import type { RollingDay } from "@/lib/utils/habit-rolling";
import { dayValue, isLoggedEntry } from "@/lib/utils/habit-score";
import {
  ENTRY_VALUE_DONE,
  ENTRY_VALUE_NOT_DONE,
  type Habit,
} from "@/lib/types/habit";
import {
  HabitQuantityPopover,
  quantityLoggedPhrase,
} from "./HabitQuantityPopover";

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
  const unit = habit?.unit;
  const complete = !isMeasurable && hasEntry && value === ENTRY_VALUE_DONE;
  const missed = !isMeasurable && hasEntry && value === ENTRY_VALUE_NOT_DONE;
  const skipped = hasEntry && !isLoggedEntry(value);
  const logged = isMeasurable && hasEntry && !skipped;
  const filled =
    complete || (logged && habit != null && dayValue(value, habit) >= 1);

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

  const status = complete
    ? "completed"
    : missed
      ? "missed"
      : skipped
        ? "skipped"
        : "not completed";
  const cellLabel = isMeasurable
    ? `${format(parseISO(date), "EEEE MMM d")}, ${quantityLoggedPhrase(logged ? value : null, unit, skipped)} — log amount`
    : `${format(parseISO(date), "EEEE MMM d")}, ${status} — toggle`;

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
      {logged && (
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={filled ? { color: getContrastingColor(color) } : undefined}
        >
          {value}
        </span>
      )}
    </span>
  );

  if (isMeasurable) {
    return (
      <div className="flex min-w-0 flex-col items-center gap-1 lg:flex-none lg:gap-1.5">
        {weekdayHeader}
        <HabitQuantityPopover
          loggedValue={logged ? value : null}
          hasEntry={hasEntry}
          unit={unit}
          onLog={(amount) => onLogValue?.(date, amount)}
          onClear={() => onClearValue?.(date)}
        >
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={cellLabel}
            className={cn(
              "group flex items-center justify-center rounded-md transition-seijaku-fast",
              cellSizing,
            )}
          >
            {cellContent}
          </button>
        </HabitQuantityPopover>
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
          onToggle(date);
        }}
        aria-pressed={complete}
        aria-label={cellLabel}
        className={cn(
          "group flex items-center justify-center rounded-md transition-seijaku-fast",
          cellSizing,
        )}
      >
        {cellContent}
      </button>
    </div>
  );
}
