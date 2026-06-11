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

  // Visual cell stays 36px regardless of pointer; coarse pointers get a 44px
  // tap target via the button's hit area, with the visual cell centered inside.
  const hitSizing = coarse ? "h-11 w-11" : "h-9 w-9";

  return (
    <div className="flex flex-none flex-col items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider leading-none text-foreground/50">
        {weekdayLabel}
      </span>
      {isBeforeStart ? (
        <div
          aria-hidden
          className={cn("rounded-md bg-transparent", hitSizing)}
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
            hitSizing,
          )}
        >
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md border transition-seijaku-fast",
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
