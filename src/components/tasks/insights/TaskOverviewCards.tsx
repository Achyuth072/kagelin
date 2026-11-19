"use client";

import { useMemo } from "react";
import { MetricCard } from "@/components/stats/MetricCard";
import {
  getTaskTotalCompletions,
  getTaskOnTimeRate,
  type TaskOccurrence,
} from "@/lib/utils/task-metrics";
import { CheckCircle2, CalendarCheck, Clock, ListChecks } from "lucide-react";

export interface TaskOverviewCardsProps {
  occurrences: TaskOccurrence[];
  totalFocusDuration?: number | null;
}

function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function formatFocusDuration(seconds: number): string {
  if (seconds < 60) return "<1m";
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function TaskOverviewCards({
  occurrences,
  totalFocusDuration,
}: TaskOverviewCardsProps) {
  const { totalCompletions, onTimeRate } = useMemo(
    () => ({
      totalCompletions: getTaskTotalCompletions(occurrences),
      onTimeRate: getTaskOnTimeRate(occurrences),
    }),
    [occurrences],
  );

  const hasFocus =
    typeof totalFocusDuration === "number" && totalFocusDuration > 0;
  const completionBreakdown =
    occurrences.length > 0
      ? `${totalCompletions} / ${occurrences.length}`
      : "—";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <MetricCard
        title="Total Completions"
        value={totalCompletions}
        icon={CheckCircle2}
        size="compact"
      />
      <MetricCard
        title="On-Time Delivery Rate"
        value={formatRate(onTimeRate)}
        icon={CalendarCheck}
        size="compact"
      />
      {hasFocus ? (
        <MetricCard
          title="Total Focus Duration"
          value={formatFocusDuration(totalFocusDuration)}
          icon={Clock}
          size="compact"
        />
      ) : (
        <MetricCard
          title="Completion Breakdown"
          value={completionBreakdown}
          icon={ListChecks}
          size="compact"
        />
      )}
    </div>
  );
}
