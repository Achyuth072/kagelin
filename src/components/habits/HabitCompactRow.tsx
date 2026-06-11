"use client";

import { useRef, useLayoutEffect } from "react";
import type { LucideIcon } from "lucide-react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { useMarkHabitComplete } from "@/lib/hooks/useHabitMutations";
import { useCoarsePointer } from "@/lib/hooks/useCoarsePointer";
import { getCurrentStreak } from "@/lib/utils/habit-streak";
import { getRolling7Days } from "@/lib/utils/habit-rolling";
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { DragHandle } from "@/components/tasks/DragHandle";
import { HabitStripCell } from "./HabitStripCell";

interface HabitCompactRowProps {
  habit: HabitWithEntries;
  icon?: LucideIcon;
  onEdit?: () => void;
  // Drag wiring (compact view): desktop shows a left-edge handle, mobile spreads
  // the listeners on the whole row behind a long-press delay.
  isDesktop?: boolean;
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: DraggableAttributes;
  dragActivatorRef?: (element: HTMLElement | null) => void;
}

/**
 * Dense single-habit row for the compact view: colored icon + name + current
 * streak + rolling-7 tappable strip. Whole row opens edit; cell taps log a day
 * (cells stopPropagation). Stacked two-line on mobile, single-line on md+.
 */
export function HabitCompactRow({
  habit,
  icon: Icon,
  onEdit,
  isDesktop,
  dragListeners,
  dragAttributes,
  dragActivatorRef,
}: HabitCompactRowProps) {
  const markComplete = useMarkHabitComplete();
  const coarse = useCoarsePointer();
  const stripRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const streak = getCurrentStreak(habit.entries, today);
  const days = getRolling7Days(habit.entries, today, habit.start_date);

  // Pin the strip to the current day (right end) synchronously before paint, so
  // there's no left→right scroll flash on mount. useLayoutEffect runs after the
  // strip is laid out but before the browser paints, so scrollWidth is final —
  // deferring to rAF (as the grid does) lets the initial frame paint at the
  // left edge first, which reads as a jump.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (strip) {
      strip.scrollLeft = strip.scrollWidth;
    }
  }, []);

  const handleToggle = (date: string) => {
    const current = habit.entries.find((e) => e.date === date)?.value ?? 0;
    markComplete.mutate({
      habitId: habit.id,
      date,
      value: current === 1 ? 0 : 1,
    });
  };

  return (
    <div
      onClick={onEdit}
      {...(!isDesktop ? dragAttributes : {})}
      {...(!isDesktop ? dragListeners : {})}
      className="group flex cursor-pointer flex-col gap-3 px-4 py-3.5 transition-seijaku-fast hover:bg-secondary/20 md:flex-row md:items-center md:gap-4"
    >
      {/* Desktop: left-edge drag handle (behind a 5px mouse-sensor distance). */}
      {isDesktop && (
        <DragHandle
          ref={dragActivatorRef}
          dragListeners={dragListeners}
          dragAttributes={dragAttributes}
          variant="desktop"
          className="shrink-0"
        />
      )}

      {/* Left: icon + name + streak (line 1 on mobile, flex-left on desktop) */}
      <div className="flex min-w-0 items-center gap-3 md:flex-1">
        {Icon && (
          <Icon
            className="h-5 w-5 shrink-0"
            strokeWidth={2.25}
            style={{ color: habit.color }}
          />
        )}
        <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">
          {habit.name}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 md:ml-0">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {streak}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
            Streak
          </span>
        </div>
      </div>

      {/* Rolling-7 strip (line 2 full-width on mobile, pinned right on desktop) */}
      <div
        ref={stripRef}
        className="flex w-full justify-between gap-1.5 overflow-x-auto scrollbar-hide px-1.5 py-1.5 md:w-auto md:justify-normal md:shrink-0"
      >
        {days.map((day) => (
          <HabitStripCell
            key={day.date}
            day={day}
            color={habit.color}
            coarse={coarse}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  );
}
