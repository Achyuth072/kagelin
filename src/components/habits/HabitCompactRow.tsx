"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import {
  BarChart2,
  Check,
  X,
  Pause,
  Flame,
  type LucideIcon,
} from "lucide-react";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { useHabitCellActions } from "@/lib/hooks/useHabitCellActions";
import { useCoarsePointer } from "@/lib/hooks/useCoarsePointer";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { getCurrentStreak } from "@/lib/utils/habit-streak";
import { getRolling7Days, type RollingDay } from "@/lib/utils/habit-rolling";
import {
  getFrequencyProgress,
  frequencyProgressLabel,
  showsFrequencyRing,
  isOnceEveryDDays,
  getLastDoneNext,
  lastDoneNextLabel,
} from "@/lib/utils/habit-frequency-progress";
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { DragHandle } from "@/components/tasks/DragHandle";
import { CircularProgress } from "@/components/ui/circular-progress";
import { ReadableText } from "@/components/encryption/ReadableText";
import { dayValue } from "@/lib/utils/habit-score";
import { entryStateName } from "@/lib/utils/habit-entry-cycle";
import { useEntryAnnouncement } from "@/lib/hooks/useEntryAnnouncement";
import {
  ENTRY_VALUE_DONE,
  ENTRY_VALUE_NOT_DONE,
  ENTRY_VALUE_SKIPPED,
} from "@/lib/types/habit";
import { HabitQuantityPopover } from "./HabitQuantityPopover";
import { getContrastingColor } from "@/lib/utils/color";
import { cn } from "@/lib/utils";

interface HabitCompactRowProps {
  habit: HabitWithEntries;
  icon?: LucideIcon;
  onEdit?: () => void;
  onViewInsights?: () => void;
  isDesktop?: boolean;
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: DraggableAttributes;
  dragActivatorRef?: (element: HTMLElement | null) => void;
}

/**
 * Compact habit row (Variant B: Timeline Matrix):
 * - Height: 44px (h-11) on desktop, single unified line.
 * - Left: Optional DragHandle (desktop), habit accent stripe, icon, title, optional cadence, micro streak badge.
 * - Right: 7-day 24px squircle matrix with 4px gap + hover insight button.
 */
export function HabitCompactRow({
  habit,
  icon: Icon,
  onEdit,
  onViewInsights,
  isDesktop,
  dragListeners,
  dragAttributes,
  dragActivatorRef,
}: HabitCompactRowProps) {
  const { onToggle, onLogValue, onClearValue } = useHabitCellActions(habit);
  const coarse = useCoarsePointer();
  const { trigger: triggerHaptic } = useHaptic();

  const today = new Date();
  const streak = getCurrentStreak(habit, habit.entries, today);
  const days = getRolling7Days(habit.entries, today, habit.start_date);

  const showLastDoneNext = isOnceEveryDDays(habit);
  const showFrequencyRing = showsFrequencyRing(habit);
  const frequencyProgress = showFrequencyRing
    ? getFrequencyProgress(habit, habit.entries, today)
    : null;
  const lastDoneNext = showLastDoneNext
    ? getLastDoneNext(habit, habit.entries, today)
    : null;

  return (
    <div
      onClick={onEdit}
      {...(!isDesktop ? dragAttributes : {})}
      {...(!isDesktop ? dragListeners : {})}
      className="group flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-2.5 sm:py-0 sm:h-11 transition-seijaku-fast hover:bg-secondary/40 active:bg-secondary/70 cursor-pointer select-none"
    >
      {/* Left: Desktop Drag Handle + Accent Stripe + Icon + Name + Cadence + Micro Streak */}
      <div className="flex min-w-0 items-center gap-2.5 flex-1 w-full sm:w-auto">
        {isDesktop && (
          <DragHandle
            ref={dragActivatorRef}
            dragListeners={dragListeners}
            dragAttributes={dragAttributes}
            variant="desktop"
            className="shrink-0 -ml-1 mr-0.5"
          />
        )}
        <div
          className="w-1.5 h-5 sm:h-6 rounded-full shrink-0"
          style={{ backgroundColor: habit.color }}
        />
        {Icon ? (
          <Icon
            className="h-4.5 w-4.5 shrink-0"
            strokeWidth={2.25}
            style={{ color: habit.color }}
          />
        ) : (
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: habit.color }}
          />
        )}
        <span className="truncate text-[14px] font-medium tracking-tight text-foreground">
          <ReadableText text={habit.name} />
        </span>

        {/* Optional Cadence: 1-in-D or Frequency Ring */}
        {lastDoneNext ? (
          <span className="text-[12px] font-medium text-foreground/70 hidden md:inline shrink-0">
            {lastDoneNextLabel(lastDoneNext)}
          </span>
        ) : (
          frequencyProgress && (
            <CircularProgress
              value={frequencyProgress.completed}
              max={frequencyProgress.target}
              size={16}
              strokeWidth={2.5}
              color={habit.color}
              label={frequencyProgressLabel(frequencyProgress)}
              className="mr-0.5 hidden md:inline-flex shrink-0"
            />
          )
        )}

        {/* Micro streak badge */}
        <div
          className="ml-auto sm:ml-2 flex items-center gap-1 shrink-0 bg-secondary/80 border border-border/50 px-2 py-0.5 rounded-[5px] text-xs tabular-nums font-semibold text-foreground"
          title={`${streak} streak`}
        >
          <Flame
            className="h-3.5 w-3.5 text-brand"
            strokeWidth={2.25}
            aria-hidden
          />
          <span>{streak}</span>
          <span className="sr-only">streak</span>
        </div>
      </div>

      {/* Right: Unbroken 7-Day Squircle Matrix (192px width, 24px squircles) + Insights Button */}
      <div className="flex shrink-0 items-center w-full sm:w-auto justify-between sm:justify-start mt-2.5 sm:mt-0">
        <div className="grid grid-cols-7 gap-1 w-full sm:w-[192px]">
          {days.map((day) => (
            <CompactMatrixCell
              key={day.date}
              day={day}
              habit={habit}
              coarse={coarse}
              onToggle={onToggle}
              onLogValue={onLogValue}
              onClearValue={onClearValue}
              onHaptic={(isToday) =>
                triggerHaptic(isToday ? "success" : "toggle")
              }
            />
          ))}
        </div>

        {onViewInsights && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewInsights();
            }}
            className="hidden sm:flex ml-2 h-7 w-7 items-center justify-center rounded-[6px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-seijaku-fast hover:bg-secondary hover:text-foreground shrink-0"
            aria-label="View insights"
            title="View Insights"
          >
            <BarChart2 className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}
      </div>
    </div>
  );
}

interface CompactMatrixCellProps {
  day: RollingDay;
  habit: HabitWithEntries;
  coarse: boolean;
  onToggle: (date: string) => void;
  onLogValue?: (date: string, value: number) => void;
  onClearValue?: (date: string) => void;
  onHaptic: (isToday: boolean) => void;
}

function CompactMatrixCell({
  day,
  habit,
  coarse,
  onToggle,
  onLogValue,
  onClearValue,
  onHaptic,
}: CompactMatrixCellProps) {
  const { date, value, hasEntry, isToday, isBeforeStart, isFuture } = day;
  const inert = isBeforeStart || isFuture;
  const isMeasurable = habit.habit_type === "measurable";
  const color = habit.color;

  const stored = hasEntry ? value : null;
  const complete = !isMeasurable && stored === ENTRY_VALUE_DONE;
  const missed = !isMeasurable && stored === ENTRY_VALUE_NOT_DONE;
  const skipped = stored === ENTRY_VALUE_SKIPPED;
  const loggedValue =
    isMeasurable && stored !== null && !skipped ? stored : null;
  const filled =
    complete || (loggedValue !== null && dayValue(loggedValue, habit) >= 1);

  const stateText = entryStateName(stored, habit);
  const { liveRegion, onActivate } = useEntryAnnouncement(stored, stateText);

  if (inert) {
    return (
      <div
        aria-hidden
        className="h-6 w-6 rounded-[7px] bg-transparent opacity-15"
      />
    );
  }

  const cellLabel = `${format(parseISO(date), "EEEE MMM d")}, ${stateText}${isMeasurable ? " — log amount" : ""}`;

  const buttonContent = (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center rounded-[6px] transition-seijaku-fast",
        filled
          ? "border-transparent text-white"
          : missed
            ? "bg-destructive-surface border border-destructive-surface-border text-destructive-surface-foreground"
            : skipped
              ? "bg-secondary border border-border text-muted-foreground"
              : isToday
                ? "border-2 border-foreground bg-secondary/40 hover:bg-secondary/60 ring-2 ring-brand ring-offset-1 ring-offset-card"
                : "border border-border/50 bg-secondary/25 hover:bg-secondary/60 hover:border-border",
      )}
      style={filled ? { backgroundColor: color } : undefined}
    >
      {(complete || (isMeasurable && filled)) && (
        <Check
          className="h-3.5 w-3.5"
          strokeWidth={3}
          style={{ color: getContrastingColor(color) }}
        />
      )}
      {missed && <X className="h-3 w-3" strokeWidth={3} />}
      {skipped && <Pause className="h-2.5 w-2.5" strokeWidth={3} />}
      {isMeasurable && loggedValue !== null && !filled && (
        <span className="text-[10px] font-semibold tabular-nums leading-none">
          {loggedValue}
        </span>
      )}
    </span>
  );

  const cellButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onHaptic(isToday);
        onActivate();
        if (!isMeasurable) {
          onToggle(date);
        }
      }}
      aria-label={cellLabel}
      title={stateText}
      className={cn(
        "relative flex h-6 w-6 items-center justify-center rounded-[7px] transition-seijaku-fast shrink-0 p-0",
        coarse && "before:absolute before:-inset-1 before:content-['']",
      )}
    >
      {buttonContent}
    </button>
  );

  return (
    <div className="flex items-center justify-center">
      {isMeasurable ? (
        <HabitQuantityPopover
          stored={stored}
          unit={habit.unit}
          targetValue={habit.target_value}
          onLog={(amount) => onLogValue?.(date, amount)}
          onClear={() => onClearValue?.(date)}
        >
          {cellButton}
        </HabitQuantityPopover>
      ) : (
        cellButton
      )}
      {liveRegion}
    </div>
  );
}
