"use client";

import { useMemo } from "react";
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
  // Day-counting metrics (Streak / Best Streak / Total Completions) are shown
  // for Boolean Habits only — for a measurable at_most habit they would read as
  // an unbroken streak across every unlogged day. See CONTEXT.md.
  const showDayCounts = habit.habit_type !== "measurable";

  const { score, currentStreak, bestStreak, totalCompletions } = useMemo(
    () => ({
      score: Math.round(currentScore(habit, entries) * 100),
      currentStreak: showDayCounts ? getCurrentStreak(habit, entries) : 0,
      bestStreak: showDayCounts
        ? (getBestStreaks(habit, entries, 1)[0] ?? 0)
        : 0,
      totalCompletions: showDayCounts ? getTotalCompletions(habit, entries) : 0,
    }),
    [habit, entries, showDayCounts],
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard title="Score" value={`${score}%`} icon={Target} />
      {showDayCounts && (
        <>
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
        </>
      )}
    </div>
  );
}
