"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useTaskSeries } from "@/lib/hooks/useTasks";
import { EmptyState } from "@/components/ui/EmptyState";
import { InsightSection } from "@/components/ui/InsightSection";
import { TaskOverviewCards } from "@/components/tasks/insights/TaskOverviewCards";
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
import type { Task } from "@/lib/types/task";
import { CheckSquare } from "lucide-react";

// Tasks have no per-item color (unlike Habits) — fall back to the brand hue.
const HISTORY_HEATMAP_COLOR = "#4B6CB7";

interface TaskInsightsPanelProps {
  task: Task;
}

export function TaskInsightsPanel({ task }: TaskInsightsPanelProps) {
  const seriesId = task.recurring_series_id;
  const { data: occurrences, isLoading } = useTaskSeries(seriesId);

  const historyEntries = useMemo(
    () =>
      (occurrences ?? [])
        .filter((o) => o.is_completed && o.completed_at)
        .map((o) => ({
          date: format(parseISO(o.completed_at!), "yyyy-MM-dd"),
          value: 1,
        })),
    [occurrences],
  );

  if (isLoading) {
    return (
      <div className="px-4 pt-4 pb-4 md:px-6 space-y-4 contain-layout">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-border/80 bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!occurrences || occurrences.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No data yet"
        description="Complete this task a few times to see insights."
        className="px-4 py-12 md:px-6 gap-3"
      />
    );
  }

  return (
    <div className="px-4 pt-4 pb-4 md:px-6 space-y-4 contain-layout">
      <TaskOverviewCards occurrences={occurrences} />

      <InsightSection title="History">
        <div className="w-full overflow-x-auto pb-1 scrollbar-hide min-w-0">
          <HabitHeatmap
            entries={historyEntries}
            color={HISTORY_HEATMAP_COLOR}
          />
        </div>
      </InsightSection>
    </div>
  );
}
