"use client";

import type { Task } from "@/lib/types/task";

interface TaskInsightsPanelProps {
  task: Task;
}

export function TaskInsightsPanel({ task: _task }: TaskInsightsPanelProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
      Insights coming soon
    </div>
  );
}
