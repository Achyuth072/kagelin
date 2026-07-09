"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { HabitHeatmap } from "./HabitHeatmap";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useMarkHabitComplete } from "@/lib/hooks/useHabitMutations";
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { BarChart2, Check, Plus, LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import { getCurrentStreak } from "@/lib/utils/habit-streak";
import { getContrastingColor } from "@/lib/utils/color";
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

/**
 * HabitCard Component
 *
 * Displays a habit with its heatmap, stats, and completion toggle.
 * Implements a prioritized heatmap layout:
 * - Stats moved to header for better focus hierarchy.
 * - Auto-scrolls heatmap to most recent data in the background.
 */
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

  // Stable ref setter — only sets the ref once on mount, never triggers detach/reattach
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    (
      scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>
    ).current = node;
  }, []);

  // Attach/detach horizontal scroll listener only when isMobile changes, not on every render
  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;
    if (!isMobile) {
      horizontalScrollRef(node);
      return () => horizontalScrollRef(null);
    }
  }, [isMobile, horizontalScrollRef]);

  // Background scroll to end on mount
  useLayoutEffect(() => {
    // Only auto-scroll once on initial mount / data load, not on every re-render
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
  const isCompletedToday = todayEntry?.value === 1;

  const totalCompletions = habit.entries.filter((e) => e.value === 1).length;
  const currentStreak = getCurrentStreak(habit, habit.entries);

  // Frequency progress ring — Boolean Habits only (CONTEXT.md "Done"-counting
  // vs strength metrics): an at_most Measurable Habit would read misleadingly
  // against a raw frequency count. Also requires a non-trivial target — a plain
  // daily habit's "1/1" ring is redundant next to the toggle.
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

    // Default: mark today as complete/incomplete
    markComplete.mutate({
      habitId: habit.id,
      date: today,
      value: isCompletedToday ? 0 : 1,
    });
  }, [onToggle, markComplete, habit.id, today, isCompletedToday]);

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
              {/* Primary action: sleek 36px visual, but an invisible
                  before:-inset-1 halo expands the tap area to the 44px mobile
                  touch-target minimum. */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle();
                }}
                className={`relative h-9 w-9 rounded-lg flex items-center justify-center transition-seijaku-fast shrink-0 before:absolute before:-inset-1 before:content-[''] ${
                  isCompletedToday
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary border border-border hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                }`}
                style={
                  isCompletedToday
                    ? { backgroundColor: habit.color }
                    : undefined
                }
                aria-label={
                  isCompletedToday ? "Mark incomplete" : "Mark complete"
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
          />
        </div>
      </div>
    </Card>
  );
}
