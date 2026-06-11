"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RollingDay } from "@/lib/utils/habit-rolling";

interface HabitStripCellProps {
  day: RollingDay;
  color: string;
  /** Coarse pointer → ≥44×44 touch targets; fine pointer may shrink. */
  coarse: boolean;
  onToggle: (date: string) => void;
}

/**
 * One day in the compact rolling-7 strip: weekday letter above a tappable
 * card-toggle cell. Complete = color fill + check, incomplete = bordered,
 * today = ringed, days before start_date render inert.
 */
export function HabitStripCell({
  day,
  color,
  coarse,
  onToggle,
}: HabitStripCellProps) {
  const { date, weekdayLabel, value, isToday, isBeforeStart } = day;
  const complete = value === 1;

  const sizing = coarse ? "h-11 md:w-11" : "h-9 md:w-9";

  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 md:flex-none">
      <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-foreground/50">
        {weekdayLabel}
      </span>
      {isBeforeStart ? (
        <div
          aria-hidden
          className={cn("w-full rounded-md bg-transparent md:w-auto", sizing)}
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(date);
          }}
          aria-pressed={complete}
          aria-label={`${date} — ${complete ? "completed" : "not completed"}, toggle`}
          className={cn(
            "flex w-full items-center justify-center rounded-md border transition-seijaku-fast md:w-auto",
            complete
              ? "border-transparent"
              : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary",
            isToday && "ring-2 ring-offset-2 ring-offset-background",
            sizing,
          )}
          style={{
            ...(complete ? { backgroundColor: color } : undefined),
            ...(isToday
              ? ({ "--tw-ring-color": color } as React.CSSProperties)
              : undefined),
          }}
        >
          {complete && <Check className="h-4 w-4 text-black" strokeWidth={3} />}
        </button>
      )}
    </div>
  );
}
