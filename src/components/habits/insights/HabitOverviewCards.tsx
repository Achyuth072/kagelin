"use client";

import { MetricCard } from "@/components/stats/MetricCard";
import { currentScore } from "@/lib/utils/habit-score";
import {
  getCurrentStreak,
  getBestStreaks,
  getTotalCompletions,
} from "@/lib/utils/habit-streak";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { Trophy, Flame, Target, CheckCircle2 } from "lucide-react";

interface HabitOverviewCardsProps {
  habit: Habit;
  entries: HabitEntry[];
}

export function HabitOverviewCards({
  habit,
  entries,
}: HabitOverviewCardsProps) {
  const score = Math.round(currentScore(habit, entries) * 100);
  const currentStreak = getCurrentStreak(habit, entries);
  const bestStreak = getBestStreaks(habit, entries, 1)[0] ?? 0;
  const totalCompletions = getTotalCompletions(habit, entries);

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard title="Score" value={`${score}%`} icon={Target} />
      <MetricCard
        title="Current Streak"
        value={`${currentStreak} days`}
        icon={Flame}
      />
      <MetricCard
        title="Best Streak"
        value={`${bestStreak} days`}
        icon={Trophy}
      />
      <MetricCard
        title="Total Completions"
        value={totalCompletions}
        icon={CheckCircle2}
      />
    </div>
  );
}
