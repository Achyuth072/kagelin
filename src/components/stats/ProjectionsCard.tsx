"use client";

import { TrendingUp, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
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
      <div className="space-y-5">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Projections
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Estimates from your recent pace — not a guarantee
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : !hasProjection && streaksAtRisk.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Not enough data yet"
            description="Log a few days of activity to see a pace-based projection."
            className="py-8 gap-3"
          />
        ) : (
          <div className="space-y-6">
            {hasProjection && (
              <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
                <ProjectionMetric
                  label="Tasks this month"
                  projected={`~${Math.round(tasks.projected)}`}
                  soFar={tasks.soFar}
                  projectedValue={tasks.projected}
                  caption={`${tasks.soFar} completed so far`}
                />
                <ProjectionMetric
                  label="Focus this month"
                  projected={`~${Math.round(focusHours.projected * 10) / 10}h`}
                  soFar={focusHours.soFar}
                  projectedValue={focusHours.projected}
                  caption={`${Math.round(focusHours.soFar * 10) / 10}h logged so far`}
                />
              </div>
            )}

            {streaksAtRisk.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Streaks at risk
                </h4>
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
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

interface ProjectionMetricProps {
  label: string;
  /** Preformatted projected headline, e.g. "~38" or "~30.3h". */
  projected: string;
  soFar: number;
  projectedValue: number;
  caption: string;
}

/**
 * One projection: label + projected headline on a row, a month-to-date pace
 * bar (so-far ÷ projected) beneath, and a caption. The bar is the "contextual
 * visual" that lets the metric fill its column instead of leaving a void.
 */
function ProjectionMetric({
  label,
  projected,
  soFar,
  projectedValue,
  caption,
}: ProjectionMetricProps) {
  const reduced = usePrefersReducedMotion();
  const pct =
    projectedValue > 0
      ? Math.min(Math.max((soFar / projectedValue) * 100, 0), 100)
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">
          {projected}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-[3px] bg-secondary/40">
        <div
          className="h-full rounded-[3px] bg-foreground/70"
          style={{
            width: `${pct}%`,
            transition: reduced ? "none" : "width 0.5s var(--ease-seijaku)",
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}
