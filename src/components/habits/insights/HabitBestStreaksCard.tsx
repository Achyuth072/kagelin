"use client";

import { getBestStreaks } from "@/lib/utils/habit-streak";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { Flame } from "lucide-react";

interface HabitBestStreaksCardProps {
  habit: Habit;
  entries: HabitEntry[];
}

export function HabitBestStreaksCard({
  habit,
  entries,
}: HabitBestStreaksCardProps) {
  const reduced = usePrefersReducedMotion();
  const streaks = getBestStreaks(habit, entries, 5);

  if (streaks.length === 0) {
    return (
      <EmptyState
        icon={Flame}
        title="No streaks yet"
        description="Build a streak to see it here."
        className="py-8 gap-3"
      />
    );
  }

  const maxRun = streaks[0];

  return (
    <div className="space-y-3">
      {streaks.map((run, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-16 text-right text-sm tabular-nums text-muted-foreground">
            {run} days
          </div>
          <div className="flex-1 h-6 rounded-md bg-secondary/50 overflow-hidden">
            <div
              className="h-full rounded-md"
              style={{
                width: `${(run / maxRun) * 100}%`,
                backgroundColor: habit.color,
                transition: reduced ? "none" : "width 0.5s ease-out",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
