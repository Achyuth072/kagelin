"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/ui/EmptyState";
import { computeScores } from "@/lib/utils/habit-score";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { LineChart as LineChartIcon } from "lucide-react";

type Period = "week" | "month" | "year";

const PERIOD_SLICE: Record<Period, number> = {
  week: 7,
  month: 30,
  year: 365,
};

interface HabitScoreChartProps {
  habit: Habit;
  entries: HabitEntry[];
}

export function HabitScoreChart({ habit, entries }: HabitScoreChartProps) {
  const [period, setPeriod] = useState<Period>("month");
  const reduced = usePrefersReducedMotion();

  const fullSeries = computeScores(habit, entries);
  const slice = PERIOD_SLICE[period];
  const data = fullSeries.slice(-slice).map((d) => ({
    date: d.date,
    score: Math.round(d.value * 100),
  }));

  if (data.length === 0) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="No score data"
        description="Log this habit to see your score trend."
        className="py-8 gap-3"
      />
    );
  }

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={period}
        onValueChange={(next) => {
          if (next) setPeriod(next as Period);
        }}
        className="w-fit"
      >
        <ToggleGroupItem value="week">Week</ToggleGroupItem>
        <ToggleGroupItem value="month">Month</ToggleGroupItem>
        <ToggleGroupItem value="year">Year</ToggleGroupItem>
      </ToggleGroup>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value) => [`${value}%`, "Score"]}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={habit.color}
            fill={habit.color}
            fillOpacity={0.15}
            strokeWidth={2}
            isAnimationActive={!reduced}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
