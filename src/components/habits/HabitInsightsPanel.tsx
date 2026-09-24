"use client";

import { useState } from "react";
import { BarChart3, Download, Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InsightSection } from "@/components/ui/InsightSection";
import { CircularProgress } from "@/components/ui/circular-progress";
import { HabitOverviewCards } from "@/components/habits/insights/HabitOverviewCards";
import { HabitScoreChart } from "@/components/habits/insights/HabitScoreChart";
import { HabitMonthGrid } from "@/components/habits/insights/HabitMonthGrid";
import { HabitBestStreaksCard } from "@/components/habits/insights/HabitBestStreaksCard";
import { HabitFrequencyGrid } from "@/components/habits/insights/HabitFrequencyGrid";
import { useHabit } from "@/lib/hooks/useHabits";
import { useHaptic } from "@/lib/hooks/useHaptic";
import {
  getFrequencyProgress,
  frequencyProgressLabel,
  hasFrequencyTarget,
} from "@/lib/utils/habit-frequency-progress";
import {
  analyticsFilename,
  habitHistoryToCsv,
  triggerDownload,
} from "@/lib/utils/stats-export";
import type { Habit, HabitWithEntries } from "@/lib/types/habit";

interface HabitInsightsPanelProps {
  habit: Habit;
}

export function HabitInsightsPanel({
  habit: habitProp,
}: HabitInsightsPanelProps) {
  const { data, isLoading } = useHabit(habitProp.id);
  const { trigger } = useHaptic();
  const [isExporting, setIsExporting] = useState(false);

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

  const habit: HabitWithEntries = data ?? { ...habitProp, entries: [] };
  const entries = habit.entries;

  const handleExportHistory = () => {
    trigger("toggle");
    setIsExporting(true);
    try {
      const csv = habitHistoryToCsv(habit, entries);
      triggerDownload(
        analyticsFilename("habit", "csv", { habitId: habit.id }),
        csv,
        "text/csv",
      );
      notify.success("Habit history exported as CSV");
      trigger("success");
    } catch (err) {
      console.error("Habit history export failed:", err);
      notify.error("Failed to export habit history");
      trigger("thud");
    } finally {
      setIsExporting(false);
    }
  };

  const showFrequencyRing =
    habit.habit_type !== "measurable" && hasFrequencyTarget(habit);
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

      <InsightSection
        title="History"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportHistory}
            disabled={isExporting || entries.length === 0}
            className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-brand transition-colors -my-1"
          >
            {isExporting ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                strokeWidth={2.25}
              />
            ) : (
              <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
            )}
            Export history
          </Button>
        }
      >
        <HabitMonthGrid habit={habit} />
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
