"use client";

import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatsBarList,
  type StatsBarListItem,
} from "@/components/stats/StatsBarList";
import { useHabits } from "@/lib/hooks/useHabits";
import { currentScore } from "@/lib/utils/habit-score";
import { cn } from "@/lib/utils";

const TOP_N = 8;

interface HabitScoreComparisonProps {
  className?: string;
}

export function HabitScoreComparison({ className }: HabitScoreComparisonProps) {
  const { data: habits, isLoading } = useHabits();

  const rows = (habits ?? [])
    .map((h) => ({
      key: h.id,
      label: h.name,
      color: h.color,
      score: Math.round(currentScore(h, h.entries) * 100),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);

  const items: StatsBarListItem[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    displayValue: `${r.score}%`,
    color: r.color,
    ratio: r.score / 100,
  }));

  return (
    <Card className={cn("p-6 border-border/50", className)}>
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Habit Score Comparison
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Current Score — not affected by the period selector
          </p>
        </div>
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No habits yet"
            description="Create a habit to see its Score here."
            className="py-8 gap-3"
          />
        ) : (
          <StatsBarList items={items} labelWidthClassName="w-40 sm:w-56" />
        )}
      </div>
    </Card>
  );
}
