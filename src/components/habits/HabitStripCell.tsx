"use client";

import { useState } from "react";
import { Check, X, Pause } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { getContrastingColor } from "@/lib/utils/color";
import type { RollingDay } from "@/lib/utils/habit-rolling";
import {
  KANSO_VALUE_DONE,
  KANSO_VALUE_SKIP,
  KANSO_VALUE_MISSED,
} from "@/lib/types/habit";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useHaptic } from "@/lib/hooks/useHaptic";

interface HabitStripCellProps {
  day: RollingDay;
  color: string;
  /** Coarse pointer requires ≥44×44 touch targets. */
  coarse: boolean;
  onToggle: (date: string) => void;
  habitType?: "boolean" | "measurable";
  targetValue?: number | null;
  targetType?: "at_least" | "at_most" | null;
  unit?: string | null;
  /** Required for measurable habits. */
  onLogValue?: (date: string, value: number) => void;
}

function isTargetMet(
  value: number,
  targetValue: number | null | undefined,
  targetType: "at_least" | "at_most" | null | undefined,
): boolean {
  if (!targetValue) return false;
  return targetType === "at_most" ? value <= targetValue : value >= targetValue;
}

export function HabitStripCell({
  day,
  color,
  coarse,
  onToggle,
  habitType = "boolean",
  targetValue,
  targetType,
  unit,
  onLogValue,
}: HabitStripCellProps) {
  const { date, weekdayLabel, value, hasEntry, isToday, isBeforeStart } = day;
  const isMeasurable = habitType === "measurable";
  const complete = !isMeasurable && hasEntry && value === KANSO_VALUE_DONE;
  const missed = !isMeasurable && hasEntry && value === KANSO_VALUE_MISSED;
  const skipped = hasEntry && value === KANSO_VALUE_SKIP;
  const logged = isMeasurable && hasEntry;
  const filled =
    complete || (logged && isTargetMet(value, targetValue, targetType));

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(hasEntry ? String(value) : "");
  const { trigger } = useHaptic();

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
    ? `${format(parseISO(date), "EEEE MMM d")}, ${logged ? `${value}${unit ? ` ${unit}` : ""} logged` : "not logged"} — log amount`
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
        <Popover
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setDraft(hasEntry ? String(value) : "");
          }}
        >
          <PopoverTrigger asChild>
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
          </PopoverTrigger>
          <PopoverContent
            className="w-48 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsed = Number(draft);
                if (!Number.isNaN(parsed) && parsed >= 0) {
                  trigger("success");
                  onLogValue?.(date, parsed);
                  setOpen(false);
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="number"
                inputMode="decimal"
                min={0}
                autoFocus
                aria-label="Log amount"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-8 w-16 text-center text-[13px] font-medium rounded-lg border border-border/40 bg-secondary/10 p-0 outline-none"
              />
              {unit && (
                <span className="text-[13px] text-muted-foreground">
                  {unit}
                </span>
              )}
              <button
                type="submit"
                className="ml-auto h-8 px-2.5 rounded-lg bg-brand text-brand-foreground text-[13px] font-medium transition-seijaku-fast hover:bg-brand/90"
              >
                Log
              </button>
            </form>
          </PopoverContent>
        </Popover>
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
