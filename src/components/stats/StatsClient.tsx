"use client";

import dynamic from "next/dynamic";
import { Target, CheckCircle2, Flame, Clock, Zap, Repeat } from "lucide-react";
import { MetricCard } from "@/components/stats/MetricCard";
import { PeriodSelector } from "@/components/stats/PeriodSelector";
import { TimeOfDayHeatmap } from "@/components/stats/TimeOfDayHeatmap";
import { HabitScoreComparison } from "@/components/stats/HabitScoreComparison";
import { ProjectBreakdownCard } from "@/components/stats/breakdowns/ProjectBreakdownCard";
import { PriorityBreakdownCard } from "@/components/stats/breakdowns/PriorityBreakdownCard";
import { useStats } from "@/lib/hooks/useStats";
import { useProjects } from "@/lib/hooks/useProjects";
import { useUiStore } from "@/lib/store/uiStore";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatsPeriod } from "@/lib/types/stats";

// Lazy load components (D3/Recharts are large)
const FocusTrendChart = dynamic(
  () =>
    import("@/components/stats/FocusTrendChart").then((mod) => ({
      default: mod.FocusTrendChart,
    })),
  {
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false,
  },
);

const ActivityHeatmap = dynamic(
  () =>
    import("@/components/stats/ActivityHeatmap").then((mod) => ({
      default: mod.ActivityHeatmap,
    })),
  {
    loading: () => <Skeleton className="h-48 w-full rounded-xl" />,
    ssr: false,
  },
);

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last year",
  all: "All time",
};

export function StatsClient() {
  const statsPeriod = useUiStore((s) => s.statsPeriod);
  const setStatsPeriod = useUiStore((s) => s.setStatsPeriod);

  const { data: stats, isLoading, isFetching } = useStats(statsPeriod);
  const { data: projects } = useProjects();

  if (isLoading) {
    return (
      <div className="px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-72" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-28 md:h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const hasComparison = statsPeriod !== "all";
  const focusTrendData = stats?.dailyTrend || [];

  return (
    <div className="px-4 md:px-6 py-6 pb-12 md:pb-6 scrollbar-hide">
      <div className="space-y-6 md:space-y-8">
        <div>
          <h1 className="type-h1 text-2xl md:text-3xl">Statistics</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Track your productivity and progress
          </p>
        </div>

        <PeriodSelector
          value={statsPeriod}
          onValueChange={setStatsPeriod}
          isAllLoading={statsPeriod === "all" && isFetching}
        />

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
          <MetricCard
            title="Total Focus"
            value={`${stats?.totalFocusHours || 0}h`}
            icon={Clock}
            trend={hasComparison ? stats?.trends?.focus : undefined}
          />
          <MetricCard
            title="Sessions"
            value={stats?.totalSessions?.toString() || "0"}
            icon={Zap}
          />
          <MetricCard
            title="Tasks"
            value={stats?.tasksCompleted?.toString() || "0"}
            icon={CheckCircle2}
            trend={hasComparison ? stats?.trends?.tasks : undefined}
          />
          <MetricCard
            title="Streak"
            value={`${stats?.currentStreak || 0}d`}
            icon={Flame}
          />
          <MetricCard
            title="Rate"
            value={`${stats?.completionRate || 0}%`}
            icon={Target}
            trend={hasComparison ? stats?.trends?.rate : undefined}
          />
          <MetricCard
            title="Habits"
            value={stats?.habitReps?.toString() || "0"}
            icon={Repeat}
            trend={hasComparison ? stats?.trends?.habitReps : undefined}
          />
        </div>

        <div>
          <FocusTrendChart
            data={focusTrendData}
            periodLabel={PERIOD_LABELS[statsPeriod]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProjectBreakdownCard
            data={stats?.byProject || []}
            projects={projects || []}
          />
          <PriorityBreakdownCard data={stats?.byPriority || []} />
        </div>

        <div>
          <TimeOfDayHeatmap matrix={stats?.timeOfDay || []} />
        </div>

        <div>
          <HabitScoreComparison />
        </div>

        <div>
          <ActivityHeatmap />
        </div>
      </div>
    </div>
  );
}
