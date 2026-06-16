"use client";

import { useMemo } from "react";
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

  // `today` is fixed for the row's lifetime; a date rollover is picked up on
  // the next list re-render rather than every render of every row.
  const today = useMemo(() => new Date(), []);
  const streak = useMemo(
    () => getCurrentStreak(habit, habit.entries, today),
    [habit, today],
  );
  const days = useMemo(
    () => getRolling7Days(habit.entries, today, habit.start_date),
    [habit.entries, today, habit.start_date],
  );

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
      className="group flex cursor-pointer flex-col gap-3 px-4 py-3.5 transition-seijaku-fast hover:bg-secondary/20 lg:flex-row lg:items-center lg:gap-4"
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
      <div className="flex min-w-0 items-center gap-3 lg:flex-1">
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
        <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 lg:ml-0">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {streak}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
            Streak
          </span>
        </div>
      </div>

      {/* Rolling-7 strip (full-width grid on mobile so all 7 days fit without
          scrolling, pinned-right fixed-size row on desktop) */}
      <div className="grid w-full grid-cols-7 gap-1 px-1.5 py-1.5 lg:flex lg:w-auto lg:grid-cols-none lg:justify-normal lg:gap-1.5 lg:shrink-0">
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
