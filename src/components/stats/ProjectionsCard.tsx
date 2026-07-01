"use client";

import { TrendingUp, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useHabits } from "@/lib/hooks/useHabits";
import { useStats } from "@/lib/hooks/useStats";
import {
  projectTasksThisMonth,
  projectFocusHoursThisMonth,
  getStreaksAtRisk,
} from "@/lib/utils/projections";
import { cn } from "@/lib/utils";

interface ProjectionsCardProps {
  className?: string;
}

/**
 * Self-fetches a fixed 30-day trend (like GoalsCard's independent
 * useGoalProgress fetch) rather than reusing the page's dailyTrend prop —
 * projections are month-to-date, a different scope than the page's
 * user-selectable period (which can be as short as 7d).
 */
export function ProjectionsCard({ className }: ProjectionsCardProps) {
  const { data: habits, isLoading: habitsLoading } = useHabits();
  const { data: stats, isLoading: statsLoading } = useStats("30d");
  const isLoading = habitsLoading || statsLoading;

  const dailyTrend = stats?.dailyTrend ?? [];
  const tasks = projectTasksThisMonth(dailyTrend);
  const focusHours = projectFocusHoursThisMonth(dailyTrend);
  const streaksAtRisk = getStreaksAtRisk(habits ?? []);

  const hasProjection = tasks.soFar > 0 || focusHours.soFar > 0;

  return (
    <Card className={cn("p-6 border-border/50", className)}>
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Projections
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Estimates from your recent pace — not a guarantee
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : !hasProjection && streaksAtRisk.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Not enough data yet"
            description="Log a few days of activity to see a pace-based projection."
            className="py-8 gap-3"
          />
        ) : (
          <div className="space-y-5">
            {hasProjection && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 md:p-2 rounded-lg bg-secondary shrink-0">
                    <TrendingUp
                      className="h-4 w-4 md:h-5 md:w-5 text-foreground/70"
                      strokeWidth={2.25}
                    />
                  </div>
                  <div>
                    <p className="text-xl font-semibold tracking-[-0.02em] tabular-nums">
                      ~{Math.round(tasks.projected)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      tasks this month ({tasks.soFar} so far)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1.5 md:p-2 rounded-lg bg-secondary shrink-0">
                    <TrendingUp
                      className="h-4 w-4 md:h-5 md:w-5 text-foreground/70"
                      strokeWidth={2.25}
                    />
                  </div>
                  <div>
                    <p className="text-xl font-semibold tracking-[-0.02em] tabular-nums">
                      ~{Math.round(focusHours.projected * 10) / 10}h
                    </p>
                    <p className="text-xs text-muted-foreground">
                      focus this month ({Math.round(focusHours.soFar * 10) / 10}
                      h so far)
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Streaks at risk
              </h4>
              {streaksAtRisk.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No streaks at risk right now.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {streaksAtRisk.map((risk) => (
                    <li
                      key={risk.habitId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Flame
                        className="h-3.5 w-3.5 text-destructive shrink-0"
                        strokeWidth={2.25}
                      />
                      <span className="truncate">{risk.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {risk.currentStreak}d streak — log today to keep it
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
