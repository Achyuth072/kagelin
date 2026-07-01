"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { computeScores } from "@/lib/utils/habit-score";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { LineChart as LineChartIcon } from "lucide-react";

type Period = "week" | "month" | "year";

// Shared ink & matte segmented-control trigger style (matches SheetTabToggle
// and the Settings section tabs): indigo-active pill on a matte track.
const PERIOD_TRIGGER_CLASS =
  "rounded-md px-4 h-9 text-[13px] font-medium tracking-tight border border-transparent text-muted-foreground transition-seijaku-fast hover:text-foreground hover:bg-secondary/40 data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:border-brand/20 data-[state=active]:shadow-none";

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

  // Compute the full daily series once; switching periods only reslices the tail.
  const fullSeries = useMemo(
    () => computeScores(habit, entries),
    [habit, entries],
  );
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
      <Tabs value={period} onValueChange={(next) => setPeriod(next as Period)}>
        <TabsList className="inline-flex bg-secondary/10 p-1 rounded-lg h-11 border border-border/40 shadow-none">
          <TabsTrigger value="week" className={PERIOD_TRIGGER_CLASS}>
            Week
          </TabsTrigger>
          <TabsTrigger value="month" className={PERIOD_TRIGGER_CLASS}>
            Month
          </TabsTrigger>
          <TabsTrigger value="year" className={PERIOD_TRIGGER_CLASS}>
            Year
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tickFormatter={(d: string) => format(parseISO(d), "MMM d")}
            />
            <YAxis
              domain={[0, 100]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={36}
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
              // Entry animation is disabled outright (matching FocusTrendChart)
              // to stop recharts replaying the sweep every time the Insights tab
              // remounts. This is a stricter superset of reduced-motion: the chart
              // never animates, so prefers-reduced-motion is honoured by default.
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
