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

  // Mobile: each cell fills its grid column, capped at the desktop size and
  // kept square via aspect-ratio, so all 7 days fit without scrolling even on
  // narrow phones. Desktop (lg+): fixed 44px (coarse) / 36px (fine) cell.
  const cellSizing = coarse
    ? "aspect-square w-full max-w-11 lg:aspect-auto lg:h-11 lg:w-11 lg:max-w-none"
    : "aspect-square w-full max-w-9 lg:aspect-auto lg:h-9 lg:w-9 lg:max-w-none";

  return (
    <div className="flex min-w-0 flex-col items-center gap-1 lg:flex-none lg:gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-foreground/50">
        {weekdayLabel}
      </span>
      {isBeforeStart ? (
        <div
          aria-hidden
          className={cn("rounded-md bg-transparent", cellSizing)}
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
            "group flex items-center justify-center rounded-md transition-seijaku-fast",
            cellSizing,
          )}
        >
          <span
            className={cn(
              "flex h-full w-full items-center justify-center rounded-md border transition-seijaku-fast",
              complete
                ? "border-transparent"
                : "border-border bg-secondary/40 text-muted-foreground group-hover:bg-secondary",
              isToday && "ring-2 ring-offset-2 ring-offset-background",
            )}
            style={{
              ...(complete ? { backgroundColor: color } : undefined),
              ...(isToday
                ? ({ "--tw-ring-color": color } as React.CSSProperties)
                : undefined),
            }}
          >
            {complete && (
              <Check className="h-4 w-4 text-black" strokeWidth={3} />
            )}
          </span>
        </button>
      )}
    </div>
  );
}
