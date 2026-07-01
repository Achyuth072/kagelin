"use client";

import { useHabit } from "@/lib/hooks/useHabits";
import { EmptyState } from "@/components/ui/EmptyState";
import { InsightSection } from "@/components/ui/InsightSection";
import { HabitOverviewCards } from "@/components/habits/insights/HabitOverviewCards";
import { HabitScoreChart } from "@/components/habits/insights/HabitScoreChart";
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
import { HabitBestStreaksCard } from "@/components/habits/insights/HabitBestStreaksCard";
import { HabitFrequencyGrid } from "@/components/habits/insights/HabitFrequencyGrid";
import { CircularProgress } from "@/components/ui/circular-progress";
import {
  getFrequencyProgress,
  frequencyProgressLabel,
} from "@/lib/utils/habit-frequency-progress";
import type { Habit } from "@/lib/types/habit";
import { BarChart3 } from "lucide-react";

interface HabitInsightsPanelProps {
  habit: Habit;
}

export function HabitInsightsPanel({
  habit: habitProp,
}: HabitInsightsPanelProps) {
  const { data, isLoading } = useHabit(habitProp.id);

  if (isLoading) {
    return (
      <div className="px-4 pt-4 pb-4 md:px-6 space-y-4 contain-layout">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-border/80 bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Prefer the freshly-fetched habit so its fields (frequency, target, color)
  // stay consistent with the entries from the same query — the prop comes from
  // the list cache and can lag behind an edit.
  const habit = data ?? habitProp;
  const entries = data?.entries ?? [];

  // Frequency progress ring — Boolean Habits only, same gate as HabitCard.
  const showFrequencyRing = habit.habit_type !== "measurable";
  const frequencyProgress = showFrequencyRing
    ? getFrequencyProgress(habit, entries)
    : null;

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No data yet"
        description="Log this habit to see insights."
        className="px-4 py-12 md:px-6 gap-3"
      />
    );
  }

  return (
    <div className="px-4 pt-4 pb-4 md:px-6 space-y-4 contain-layout">
      <HabitOverviewCards habit={habit} entries={entries} />

      <InsightSection title="Score">
        <HabitScoreChart habit={habit} entries={entries} />
      </InsightSection>

      <InsightSection title="History">
        <div className="w-full overflow-x-auto pb-1 scrollbar-hide min-w-0">
          <HabitHeatmap
            entries={entries}
            color={habit.color}
            startDate={habit.start_date ?? undefined}
          />
        </div>
      </InsightSection>

      {/* Best Streaks is a day-counting metric — Boolean Habits only (CONTEXT.md). */}
      {habit.habit_type !== "measurable" && (
        <InsightSection title="Best Streaks">
          <HabitBestStreaksCard habit={habit} entries={entries} />
        </InsightSection>
      )}

      <InsightSection title="Frequency">
        {frequencyProgress && (
          <div className="flex items-center gap-4 pb-1">
            <CircularProgress
              value={frequencyProgress.completed}
              max={frequencyProgress.target}
              size={64}
              strokeWidth={6}
              color={habit.color}
              label={frequencyProgressLabel(frequencyProgress)}
            >
              <span className="text-sm font-bold text-foreground tabular-nums">
                {frequencyProgress.completed}/{frequencyProgress.target}
              </span>
            </CircularProgress>
            <p className="text-sm text-muted-foreground">
              {frequencyProgressLabel(frequencyProgress)}
            </p>
          </div>
        )}
        <HabitFrequencyGrid habit={habit} entries={entries} />
      </InsightSection>
    </div>
  );
}
