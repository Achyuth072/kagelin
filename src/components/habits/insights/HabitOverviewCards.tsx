"use client";

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

  if (isMeasurable) {
    const metrics = calculateMeasurableOverviewMetrics(habit, entries);
    return (
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="Score"
          value={`${metrics.score}%`}
          trend={metrics.scoreTrend}
          icon={Target}
          size="compact"
        />
        <MetricCard
          title={metrics.targetMetRate.title}
          value={metrics.targetMetRate.value}
          icon={
            metrics.targetMetRate.title === "Target Met Rate"
              ? CheckCircle2
              : Calendar
          }
          size="compact"
        />
        <MetricCard
          title="30-Day Average"
          value={metrics.thirtyDayAverage}
          icon={Activity}
          size="compact"
        />
        <MetricCard
          title="Total Volume"
          value={metrics.totalVolume}
          icon={Trophy}
          size="compact"
        />
      </div>
    );
  }

  const score = Math.round(currentScore(habit, entries) * 100);
  const scoreTrend = calculateScoreTrend(habit, entries);
  const currentStreak = getCurrentStreak(habit, entries);
  const streakTrend = calculateStreakTrend(habit, entries);
  const bestStreak = getBestStreaks(habit, entries, 1)[0] ?? 0;
  const totalCompletions = getTotalCompletions(habit, entries);

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard
        title="Score"
        value={`${score}%`}
        trend={scoreTrend}
        icon={Target}
        size="compact"
      />
      <MetricCard
        title="Current Streak"
        value={`${currentStreak} days`}
        trend={streakTrend}
        icon={Flame}
        size="compact"
      />
      <MetricCard
        title="Best Streak"
        value={`${bestStreak} days`}
        icon={Trophy}
        size="compact"
      />
      <MetricCard
        title="Total Completions"
        value={totalCompletions}
        icon={CheckCircle2}
        size="compact"
      />
    </div>
  );
}
