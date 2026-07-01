"use client";

import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { CircularProgress } from "@/components/ui/circular-progress";
import { useUiStore } from "@/lib/store/uiStore";
import { useGoalProgress } from "@/lib/hooks/useGoalProgress";
import { cn } from "@/lib/utils";

interface GoalsCardProps {
  className?: string;
}

interface GoalRing {
  key: string;
  label: string;
  value: number;
  target: number;
  unit: string;
}

export function GoalsCard({ className }: GoalsCardProps) {
  const goals = useUiStore((s) => s.goals);
  const { data: progress, isLoading } = useGoalProgress();

  const rings: GoalRing[] = [];
  if (goals.dailyFocusHours != null) {
    rings.push({
      key: "daily-focus",
      label: "Daily Focus",
      value: progress?.focusHoursToday ?? 0,
      target: goals.dailyFocusHours,
      unit: "h",
    });
  }
  if (goals.weeklyFocusHours != null) {
    rings.push({
      key: "weekly-focus",
      label: "Weekly Focus",
      value: progress?.focusHoursThisWeek ?? 0,
      target: goals.weeklyFocusHours,
      unit: "h",
    });
  }
  if (goals.dailyTasksCompleted != null) {
    rings.push({
      key: "daily-tasks",
      label: "Daily Tasks",
      value: progress?.tasksCompletedToday ?? 0,
      target: goals.dailyTasksCompleted,
      unit: "",
    });
  }
  if (goals.weeklyTasksCompleted != null) {
    rings.push({
      key: "weekly-tasks",
      label: "Weekly Tasks",
      value: progress?.tasksCompletedThisWeek ?? 0,
      target: goals.weeklyTasksCompleted,
      unit: "",
    });
  }

  const router = useRouter();

  return (
    <Card className={cn("p-6 border-border/50", className)}>
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Goals
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Daily and weekly targets — not affected by the period selector
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : rings.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No Goals set"
            description="Set a daily or weekly focus or task target in Settings."
            action={{
              label: "Set Goals",
              onClick: () => router.push("/settings?tab=goals"),
              icon: Target,
            }}
            className="py-8 gap-3"
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {rings.map((ring) => {
              const displayValue =
                ring.unit === "h"
                  ? Math.round(ring.value * 10) / 10
                  : ring.value;
              return (
                <div
                  key={ring.key}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <CircularProgress
                    value={ring.value}
                    max={ring.target}
                    size={72}
                    strokeWidth={6}
                    label={`${displayValue} of ${ring.target}${ring.unit} — ${ring.label}`}
                  >
                    <span className="text-sm font-bold text-foreground tabular-nums">
                      {displayValue}/{ring.target}
                      {ring.unit}
                    </span>
                  </CircularProgress>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {ring.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
