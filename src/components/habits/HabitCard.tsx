"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { HabitHeatmap } from "./HabitHeatmap";
import {
  HabitQuantityPopover,
  quantityLoggedPhrase,
} from "./HabitQuantityPopover";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useMarkHabitComplete } from "@/lib/hooks/useHabitMutations";
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { BarChart2, Check, Plus, LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import { getCurrentStreak } from "@/lib/utils/habit-streak";
import { getContrastingColor } from "@/lib/utils/color";
import { dayValue, isLoggedEntry } from "@/lib/utils/habit-score";
import { ENTRY_VALUE_DONE } from "@/lib/types/habit";
import {
  getFrequencyProgress,
  frequencyProgressLabel,
  hasFrequencyTarget,
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
  const markComplete = useMarkHabitComplete();
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

  const today = format(new Date(), "yyyy-MM-dd");
  const todayEntry = habit.entries.find((e) => e.date === today);
  const isMeasurable = habit.habit_type === "measurable";
  const isCompletedToday =
    todayEntry != null && dayValue(todayEntry.value, habit) >= 1;
  const todayLogged =
    isMeasurable && todayEntry != null && isLoggedEntry(todayEntry.value)
      ? todayEntry.value
      : null;

  const totalCompletions = habit.entries.filter(
    (e) => dayValue(e.value, habit) >= 1,
  ).length;
  const currentStreak = getCurrentStreak(habit, habit.entries);

  // Boolean-only (CONTEXT.md "Done" vs strength metrics): an at_most Measurable
  // habit's raw count would read misleadingly as frequency progress.
  const showFrequencyRing =
    habit.habit_type !== "measurable" && hasFrequencyTarget(habit);
  const frequencyProgress = showFrequencyRing
    ? getFrequencyProgress(habit, habit.entries)
    : null;

  const handleToggle = useCallback(() => {
    if (onToggle) {
      onToggle();
      return;
    }

    markComplete.mutate({
      habitId: habit.id,
      date: today,
      value: isCompletedToday ? null : ENTRY_VALUE_DONE,
    });
  }, [onToggle, markComplete, habit.id, today, isCompletedToday]);

  // before:-inset-1 gives the 36px button a 44px invisible tap area (mobile touch-target minimum).
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
      aria-label={
        isMeasurable
          ? `Today, ${quantityLoggedPhrase(todayLogged, habit.unit)} — log amount`
          : isCompletedToday
            ? "Mark incomplete"
            : "Mark complete"
      }
    >
      {isCompletedToday ? (
        <Check
          className="w-5 h-5"
          strokeWidth={3}
          style={{ color: getContrastingColor(habit.color) }}
        />
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
        {/* Header: two-row — identity + actions on top, quiet metadata below.
            Unified across sizes so the name owns the width the truncated
            single-row header used to starve it of. */}
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
                  loggedValue={todayLogged}
                  hasEntry={todayEntry != null}
                  unit={habit.unit}
                  onLog={(value) =>
                    markComplete.mutate({
                      habitId: habit.id,
                      date: today,
                      value,
                    })
                  }
                  onClear={() =>
                    markComplete.mutate({
                      habitId: habit.id,
                      date: today,
                      value: null,
                    })
                  }
                >
                  {renderTodayButton((e) => e.stopPropagation())}
                </HabitQuantityPopover>
              ) : (
                renderTodayButton((e) => {
                  e.stopPropagation();
                  handleToggle();
                })
              )}
            </div>
          </div>

          {/* Quiet metadata strip — muted, inline, dot-separated. Reads as
              secondary data, not a competing row. */}
          <div className="flex items-center gap-2 text-[13px] font-medium tabular-nums text-foreground/55">
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
          </div>
        </div>

        {/* Heatmap Area - Large Visual Centerpiece */}
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
