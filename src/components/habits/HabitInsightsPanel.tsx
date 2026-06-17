"use client";

import type { Habit } from "@/lib/types/habit";

interface HabitInsightsPanelProps {
  habit: Habit;
}

export function HabitInsightsPanel({ habit: _habit }: HabitInsightsPanelProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
      Insights coming soon
    </div>
  );
}
