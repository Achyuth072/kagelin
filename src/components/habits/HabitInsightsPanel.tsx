"use client";

import { useHabit } from "@/lib/hooks/useHabits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { HabitOverviewCards } from "@/components/habits/insights/HabitOverviewCards";
import { HabitScoreChart } from "@/components/habits/insights/HabitScoreChart";
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
import { HabitBestStreaksCard } from "@/components/habits/insights/HabitBestStreaksCard";
import { HabitFrequencyGrid } from "@/components/habits/insights/HabitFrequencyGrid";
import type { Habit } from "@/lib/types/habit";
import { BarChart3 } from "lucide-react";

interface HabitInsightsPanelProps {
  habit: Habit;
}

export function HabitInsightsPanel({ habit }: HabitInsightsPanelProps) {
  const { data, isLoading } = useHabit(habit.id);

  if (isLoading) {
    return (
      <div className="px-4 pt-4 pb-4 md:px-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-border/80 bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  const entries = data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No data yet"
        description="Log this habit to see insights."
        className="px-4 py-12 md:px-6 gap-3"
      />
    );
  }

  return (
    <div className="px-4 pt-4 pb-4 md:px-6 space-y-4">
      <HabitOverviewCards habit={habit} entries={entries} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HabitScoreChart habit={habit} entries={entries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto pb-1 scrollbar-hide min-w-0">
            <HabitHeatmap
              entries={entries}
              color={habit.color}
              startDate={habit.start_date ?? undefined}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Best Streaks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HabitBestStreaksCard habit={habit} entries={entries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Frequency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HabitFrequencyGrid habit={habit} entries={entries} />
        </CardContent>
      </Card>
    </div>
  );
}
