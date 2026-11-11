"use client";

import { useMemo } from "react";
import { MetricCard } from "@/components/stats/MetricCard";
import { currentScore } from "@/lib/utils/habit-score";
import {
  getCurrentStreak,
  getBestStreaks,
  getTotalCompletions,
} from "@/lib/utils/habit-streak";
import {
  calculateScoreTrend,
  calculateStreakTrend,
  calculateMeasurableOverviewMetrics,
} from "@/lib/utils/habit-trends";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import {
  Trophy,
  Flame,
  Target,
  CheckCircle2,
  Calendar,
  Activity,
} from "lucide-react";

interface HabitOverviewCardsProps {
  habit: Habit;
  entries: HabitEntry[];
}

export function HabitOverviewCards({
  habit,
  entries,
}: HabitOverviewCardsProps) {
  const isMeasurable = habit.habit_type === "measurable";

  const booleanMetrics = useMemo(() => {
    if (isMeasurable) return null;
    return {
      score: Math.round(currentScore(habit, entries) * 100),
      scoreTrend: calculateScoreTrend(habit, entries),
      currentStreak: getCurrentStreak(habit, entries),
      streakTrend: calculateStreakTrend(habit, entries),
      bestStreak: getBestStreaks(habit, entries, 1)[0] ?? 0,
      totalCompletions: getTotalCompletions(habit, entries),
    };
  }, [habit, entries, isMeasurable]);

  const measurableMetrics = useMemo(() => {
    if (!isMeasurable) return null;
    return calculateMeasurableOverviewMetrics(habit, entries);
  }, [habit, entries, isMeasurable]);

  if (isMeasurable && measurableMetrics) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="Score"
          value={`${measurableMetrics.score}%`}
          trend={measurableMetrics.scoreTrend}
          icon={Target}
          size="compact"
        />
        <MetricCard
          title={measurableMetrics.targetMetRate.title}
          value={measurableMetrics.targetMetRate.value}
          icon={
            measurableMetrics.targetMetRate.title === "Target Met Rate"
              ? CheckCircle2
              : Calendar
          }
          size="compact"
        />
        <MetricCard
          title="30-Day Average"
          value={measurableMetrics.thirtyDayAverage}
          icon={Activity}
          size="compact"
        />
        <MetricCard
          title="Total Volume"
          value={measurableMetrics.totalVolume}
          icon={Trophy}
          size="compact"
        />
      </div>
    );
  }

  if (!booleanMetrics) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard
        title="Score"
        value={`${booleanMetrics.score}%`}
        trend={booleanMetrics.scoreTrend}
        icon={Target}
        size="compact"
      />
      <MetricCard
        title="Current Streak"
        value={`${booleanMetrics.currentStreak} days`}
        trend={booleanMetrics.streakTrend}
        icon={Flame}
        size="compact"
      />
      <MetricCard
        title="Best Streak"
        value={`${booleanMetrics.bestStreak} days`}
        icon={Trophy}
        size="compact"
      />
      <MetricCard
        title="Total Completions"
        value={booleanMetrics.totalCompletions}
        icon={CheckCircle2}
        size="compact"
      />
    </div>
  );
}
