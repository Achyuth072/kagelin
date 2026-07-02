"use client";

import { useMemo } from "react";
import { MetricCard } from "@/components/stats/MetricCard";
import {
  getTaskCompletionRate,
  getTaskOnTimeRate,
  getTaskCurrentStreak,
  getTaskBestStreak,
  getTaskTotalCompletions,
  type TaskOccurrence,
} from "@/lib/utils/task-streak";
import {
  CalendarCheck,
  Trophy,
  Flame,
  Target,
  CheckCircle2,
} from "lucide-react";

interface TaskOverviewCardsProps {
  occurrences: TaskOccurrence[];
}

function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function TaskOverviewCards({ occurrences }: TaskOverviewCardsProps) {
  const {
    completionRate,
    onTimeRate,
    currentStreak,
    bestStreak,
    totalCompletions,
  } = useMemo(
    () => ({
      completionRate: getTaskCompletionRate(occurrences),
      onTimeRate: getTaskOnTimeRate(occurrences),
      currentStreak: getTaskCurrentStreak(occurrences),
      bestStreak: getTaskBestStreak(occurrences),
      totalCompletions: getTaskTotalCompletions(occurrences),
    }),
    [occurrences],
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard
        title="Completion Rate"
        value={formatRate(completionRate)}
        icon={Target}
        size="compact"
      />
      <MetricCard
        title="On-Time"
        value={formatRate(onTimeRate)}
        icon={CalendarCheck}
        size="compact"
      />
      <MetricCard
        title="Current Streak"
        value={currentStreak}
        icon={Flame}
        size="compact"
      />
      <MetricCard
        title="Best Streak"
        value={bestStreak}
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
