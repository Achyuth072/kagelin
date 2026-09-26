"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { HabitHeatmap } from "./HabitHeatmap";
import { HabitQuantityPopover } from "./HabitQuantityPopover";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useHabitCellActions } from "@/lib/hooks/useHabitCellActions";
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { BarChart2, Check, Pause, Plus, LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import { getCurrentStreak } from "@/lib/utils/habit-streak";
import { getContrastingColor } from "@/lib/utils/color";
import { dayValue } from "@/lib/utils/habit-score";
import { ENTRY_VALUE_SKIPPED } from "@/lib/types/habit";
import { entryStateName } from "@/lib/utils/habit-entry-cycle";
import { useEntryAnnouncement } from "@/lib/hooks/useEntryAnnouncement";
import {
  getFrequencyProgress,
  frequencyProgressLabel,
  showsFrequencyRing,
  isOnceEveryDDays,
  getLastDoneNext,
  lastDoneNextLabel,
} from "@/lib/utils/habit-frequency-progress";
import { CircularProgress } from "@/components/ui/circular-progress";

interface HabitCardProps {
  habit: HabitWithEntries;
  icon?: LucideIcon;
  onToggle?: () => void;
  onEdit?: () => void;
  onViewInsights?: () => void;
}

export function HabitCard({
  habit,
  icon: Icon,
  onToggle,
  onEdit,
  onViewInsights,
}: HabitCardProps) {
  const isMobile = useIsMobile();
  const {
    onToggle: toggleDate,
    onLogValue,
    onClearValue,
  } = useHabitCellActions(habit);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useHorizontalScroll();
  const hasAutoScrolled = useRef(false);

  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    (
      scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>
    ).current = node;
  }, []);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;
    if (!isMobile) {
      horizontalScrollRef(node);
      return () => horizontalScrollRef(null);
    }
  }, [isMobile, horizontalScrollRef]);

  useLayoutEffect(() => {
    if (hasAutoScrolled.current) return;

    const frame = requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft =
          scrollContainerRef.current.scrollWidth;
        hasAutoScrolled.current = true;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [habit.entries]);

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const todayStored =
    habit.entries.find((e) => e.date === today)?.value ?? null;
  const isMeasurable = habit.habit_type === "measurable";
  const isCompletedToday =
    todayStored !== null && dayValue(todayStored, habit) >= 1;
  const isSkippedToday = todayStored === ENTRY_VALUE_SKIPPED;
  const todayStateText = entryStateName(todayStored, habit);
  const todayLabel = `Today, ${format(now, "EEEE MMM d")}, ${todayStateText}${isMeasurable ? " — log amount" : ""}`;
  const { liveRegion, onActivate } = useEntryAnnouncement(
    todayStored,
    todayStateText,
  );

  const totalCompletions = habit.entries.filter(
    (e) => dayValue(e.value, habit) >= 1,
  ).length;
  const currentStreak = getCurrentStreak(habit, habit.entries);

  const showLastDoneNext = isOnceEveryDDays(habit);
  const showFrequencyRing = showsFrequencyRing(habit);
  const frequencyProgress = showFrequencyRing
    ? getFrequencyProgress(habit, habit.entries)
    : null;
  const lastDoneNext = showLastDoneNext
    ? getLastDoneNext(habit, habit.entries)
    : null;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
      return;
    }

    toggleDate(today);
  };

  // before:-inset-1 widens the 36px button to a 44px tap target.
  const renderTodayButton = (
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void,
  ) => (
    <button
      onClick={onClick}
      className={`relative h-9 w-9 rounded-lg flex items-center justify-center transition-seijaku-fast shrink-0 before:absolute before:-inset-1 before:content-[''] ${
        isCompletedToday
          ? "bg-primary text-primary-foreground"
          : "bg-secondary border border-border hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
      }`}
      style={isCompletedToday ? { backgroundColor: habit.color } : undefined}
      aria-label={todayLabel}
      title={todayStateText}
    >
      {isCompletedToday ? (
        <Check
          className="w-5 h-5"
          strokeWidth={3}
          style={{ color: getContrastingColor(habit.color) }}
        />
      ) : isSkippedToday ? (
        <Pause className="w-4 h-4" strokeWidth={3} />
      ) : (
        <Plus className="w-5 h-5" />
      )}
    </button>
  );

  return (
    <Card
      onClick={onEdit}
      className="bg-card border border-border dark:border-border/40 p-4 sm:p-5 rounded-xl overflow-hidden shadow-none transition-seijaku-fast hover:border-border/60 hover:shadow-sm cursor-pointer active:scale-[0.995] min-w-0"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground flex items-center gap-2.5 min-w-0">
                {Icon && (
                  <Icon
                    className="w-5 h-5 shrink-0"
                    strokeWidth={2.25}
                    style={{ color: habit.color }}
                  />
                )}
                <span className="truncate">{habit.name}</span>
              </h3>
              {habit.description && (
                <p className="text-[13px] text-foreground/60 mt-1 truncate leading-relaxed font-medium">
                  {habit.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onViewInsights && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewInsights();
                  }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-secondary border border-border hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-seijaku-fast"
                  aria-label="View insights"
                >
                  <BarChart2 className="w-4 h-4" strokeWidth={2.25} />
                </button>
              )}
              {isMeasurable ? (
                <HabitQuantityPopover
                  stored={todayStored}
                  unit={habit.unit}
                  targetValue={habit.target_value}
                  onLog={(value) => onLogValue(today, value)}
                  onClear={() => onClearValue(today)}
                >
                  {renderTodayButton((e) => {
                    e.stopPropagation();
                    onActivate();
                  })}
                </HabitQuantityPopover>
              ) : (
                renderTodayButton((e) => {
                  e.stopPropagation();
                  onActivate();
                  handleToggle();
                })
              )}
              {liveRegion}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[13px] font-medium tabular-nums text-foreground/55">
            {lastDoneNext ? (
              <span className="font-medium text-foreground/70">
                {lastDoneNextLabel(lastDoneNext)}
              </span>
            ) : (
              <>
                {frequencyProgress && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <CircularProgress
                        value={frequencyProgress.completed}
                        max={frequencyProgress.target}
                        size={18}
                        strokeWidth={2.5}
                        color={habit.color}
                        label={frequencyProgressLabel(frequencyProgress)}
                      />
                      <span className="font-semibold text-foreground/90">
                        {frequencyProgress.completed}/{frequencyProgress.target}
                      </span>
                    </span>
                    <span className="text-foreground/25" aria-hidden="true">
                      ·
                    </span>
                  </>
                )}
                <span>
                  <span className="font-semibold text-foreground/90">
                    {currentStreak}
                  </span>{" "}
                  streak
                </span>
                <span className="text-foreground/25" aria-hidden="true">
                  ·
                </span>
                <span>
                  <span className="font-semibold text-foreground/90">
                    {totalCompletions}
                  </span>{" "}
                  total
                </span>
              </>
            )}
          </div>
        </div>

        <div
          ref={setScrollRef}
          className="w-full overflow-x-auto pb-1 scrollbar-hide min-w-0"
        >
          <HabitHeatmap
            entries={habit.entries}
            color={habit.color}
            blockSize={isMobile ? 10 : 14}
            blockMargin={2}
            startDate={habit.start_date ?? undefined}
            habit={habit}
          />
        </div>
      </div>
    </Card>
  );
}
