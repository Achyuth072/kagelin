"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import {
  BarChart2,
  Check,
  X,
  Minus,
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
 * Compact habit row (Ink & Matte ledger):
 * - Desktop: Natural vertical breathing (min-h-[52px] py-2.5), icon + stacked title/cadence,
 *   right-aligned tabular metadata zone, 28px squircle 7-day matrix (w-[236px]), and hover insight button.
 * - Mobile: Top row with identity, frequency ring / active streak (> 0), and muted insight button;
 *   bottom row with full-width synchronized 7-day tap tiles.
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
      role="button"
      tabIndex={0}
      aria-label={onEdit ? `Edit habit ${habit.name}` : undefined}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit?.();
        }
      }}
      {...(!isDesktop ? dragAttributes : {})}
      {...(!isDesktop ? dragListeners : {})}
      className="group flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-2.5 px-4 py-3 sm:py-2.5 sm:min-h-[52px] transition-seijaku-fast hover:bg-accent active:bg-secondary cursor-pointer select-none"
    >
      {/* Left: Desktop Drag Handle + Icon + Stacked Name & Cadence */}
      <div className="order-1 flex min-w-0 flex-1 items-center gap-2.5">
        {isDesktop && (
          <DragHandle
            ref={dragActivatorRef}
            dragListeners={dragListeners}
            dragAttributes={dragAttributes}
            variant="desktop"
            className="shrink-0 -ml-1 mr-0.5"
          />
        )}
        {Icon ? (
          <Icon
            className="h-4 w-4 shrink-0"
            strokeWidth={2.25}
            style={{ color: habit.color }}
          />
        ) : (
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: habit.color }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium tracking-tight text-foreground">
            <ReadableText text={habit.name} />
          </div>
          {lastDoneNext && (
            <div className="truncate text-xs text-muted-foreground mt-0.5">
              {lastDoneNextLabel(lastDoneNext)}
            </div>
          )}
        </div>
      </div>

      {/* Metadata Zone: Frequency Ring + Active Streak (> 0) */}
      {(frequencyProgress || streak > 0) && (
        <div className="order-2 flex shrink-0 items-center justify-end gap-2 font-mono tabular-nums text-xs text-muted-foreground sm:mr-1">
          {!lastDoneNext && frequencyProgress && (
            <CircularProgress
              value={frequencyProgress.completed}
              max={frequencyProgress.target}
              size={16}
              strokeWidth={2.5}
              color={habit.color}
              label={frequencyProgressLabel(frequencyProgress)}
              className="shrink-0"
            />
          )}

          {streak > 0 && (
            <div
              className="inline-flex items-center gap-1 rounded-md bg-secondary border border-border px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-foreground"
              title={`${streak} day streak`}
            >
              <Flame
                className="h-3 w-3 text-brand"
                strokeWidth={2.25}
                aria-hidden
              />
              <span>{streak}d</span>
              <span className="sr-only">streak</span>
            </div>
          )}
        </div>
      )}

      {/* 7-Day Squircle Matrix (full width on mobile, 236px on sm+) */}
      <div className="order-4 w-full sm:order-3 sm:w-[236px] shrink-0">
        <div className="grid grid-cols-7 gap-1.5 w-full">
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
      </div>

      {/* View Insights Button (top-right on mobile, trailing on desktop) */}
      {onViewInsights && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewInsights();
          }}
          className="order-3 sm:order-4 flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-md text-muted-foreground opacity-75 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 transition-seijaku-fast hover:bg-secondary hover:text-foreground shrink-0"
          aria-label="View insights"
          title="View Insights"
        >
          <BarChart2 className="h-4 w-4" strokeWidth={2.25} />
        </button>
      )}
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
        className="h-8 w-full sm:h-7 sm:w-7 rounded-lg sm:rounded-[7px] bg-transparent opacity-15"
      />
    );
  }

  const cellLabel = `${format(parseISO(date), "EEEE MMM d")}, ${stateText}${isMeasurable ? " — log amount" : ""}`;

  const buttonContent = (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center rounded-lg sm:rounded-[7px] transition-seijaku-fast",
        filled
          ? "border-transparent text-white"
          : missed
            ? "bg-destructive-surface border border-destructive-surface-border text-destructive-surface-foreground"
            : skipped
              ? "bg-secondary border border-border text-muted-foreground"
              : isToday
                ? "border-2 border-border-strong bg-secondary hover:border-brand"
                : "border border-border bg-background hover:border-border-strong",
      )}
      style={filled ? { backgroundColor: color } : undefined}
    >
      {(complete || (isMeasurable && filled)) && (
        <Check
          className="h-3.5 w-3.5"
          strokeWidth={2.25}
          style={{ color: getContrastingColor(color) }}
        />
      )}
      {missed && <X className="h-3 w-3" strokeWidth={2.25} />}
      {skipped && <Minus className="h-3 w-3" strokeWidth={2.25} />}
      {isMeasurable && loggedValue !== null && !filled && (
        <span className="text-[10px] font-mono font-semibold tabular-nums leading-none">
          {loggedValue}
        </span>
      )}
    </span>
  );

  const cellButton = (
    <button
      type="button"
      data-today={isToday ? "true" : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
        if (!isMeasurable) {
          onToggle(date);
        } else {
          onHaptic(isToday);
        }
      }}
      aria-label={cellLabel}
      title={stateText}
      className={cn(
        "relative flex h-8 w-full sm:h-7 sm:w-7 items-center justify-center rounded-lg sm:rounded-[7px] transition-seijaku-fast shrink-0 p-0",
        coarse && "before:absolute before:-inset-1.5 before:content-['']",
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
