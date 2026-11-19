"use client";

import { useMemo } from "react";
import { format, parseISO, isAfter } from "date-fns";
import { useTaskSeries } from "@/lib/hooks/useTasks";
import { useFocusHistoryStore } from "@/lib/store/focusHistoryStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { InsightSection } from "@/components/ui/InsightSection";
import { TaskOverviewCards } from "@/components/tasks/insights/TaskOverviewCards";
import type { Task } from "@/lib/types/task";
import { cn } from "@/lib/utils";
import { CheckSquare, CheckCircle2 } from "lucide-react";

interface TaskInsightsPanelProps {
  task: Task;
  totalFocusDuration?: number | null;
}

export function TaskInsightsPanel({
  task,
  totalFocusDuration,
}: TaskInsightsPanelProps) {
  const seriesId = task.recurring_series_id;
  const { data: occurrences, isLoading } = useTaskSeries(seriesId);
  const focusSessions = useFocusHistoryStore((state) => state.sessions);

  const seriesTaskIds = useMemo(
    () => new Set((occurrences ?? []).map((o) => o.id).concat(task.id)),
    [occurrences, task.id],
  );

  const storeFocusDuration = useMemo(() => {
    return focusSessions
      .filter((s) => s.taskId && seriesTaskIds.has(s.taskId))
      .reduce((sum, s) => sum + s.duration, 0);
  }, [focusSessions, seriesTaskIds]);

  const effectiveFocusDuration =
    totalFocusDuration !== undefined
      ? totalFocusDuration
      : storeFocusDuration > 0
        ? storeFocusDuration
        : undefined;

  const completedOccurrences = useMemo(
    () =>
      (occurrences ?? [])
        .filter((o) => o.is_completed && o.completed_at)
        .sort(
          (a, b) =>
            parseISO(b.completed_at!).getTime() -
            parseISO(a.completed_at!).getTime(),
        ),
    [occurrences],
  );

  if (isLoading) {
    return (
      <div className="px-4 pt-4 pb-4 md:px-6 space-y-4 contain-layout">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-border/80 bg-card animate-pulse motion-reduce:animate-none"
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
      <TaskOverviewCards
        occurrences={occurrences}
        totalFocusDuration={effectiveFocusDuration}
      />

      <InsightSection title="Completion History">
        {completedOccurrences.length === 0 ? (
          <div className="rounded-xl border border-border/80 bg-card/60 p-6 text-center text-xs md:text-sm text-muted-foreground">
            No completed occurrences recorded yet.
          </div>
        ) : (
          <ul
            className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card/60 overflow-hidden"
            role="list"
          >
            {completedOccurrences.map((occurrence) => {
              const completedDate = parseISO(occurrence.completed_at!);
              const formattedDate = format(completedDate, "MMM d, yyyy");
              const hasDueDate = Boolean(occurrence.due_date);
              const isOnTime =
                hasDueDate &&
                !isAfter(completedDate, parseISO(occurrence.due_date!));

              return (
                <li
                  key={occurrence.id}
                  className="flex items-center justify-between px-3.5 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2
                      className="h-4 w-4 text-brand shrink-0"
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate text-xs md:text-sm">
                        {formattedDate}
                      </p>
                      {hasDueDate && (
                        <p className="text-[11px] text-muted-foreground">
                          Due{" "}
                          {format(
                            parseISO(occurrence.due_date!),
                            "MMM d, yyyy",
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  {hasDueDate && (
                    <span
                      className={cn(
                        "text-[10px] md:text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 border",
                        isOnTime
                          ? "text-brand bg-brand/10 border-brand/20"
                          : "text-muted-foreground bg-secondary/50 border-border/50",
                      )}
                    >
                      {isOnTime ? "On time" : "Late"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </InsightSection>
    </div>
  );
}
