"use client";

import { useMemo, useState, useRef, useEffect } from "react";
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
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useHaptic } from "@/lib/hooks/useHaptic";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { LineChart as LineChartIcon } from "lucide-react";

type Period = "week" | "month" | "year";

const PERIOD_SLICE: Record<Period, number> = {
  week: 7,
  month: 30,
  year: 365,
};

function isPeriod(val: string): val is Period {
  return val === "week" || val === "month" || val === "year";
}

interface HabitScoreChartProps {
  habit: Habit;
  entries: HabitEntry[];
}

interface ScorePoint {
  date: string;
  score: number;
}

export function HabitScoreChart({ habit, entries }: HabitScoreChartProps) {
  const [period, setPeriod] = useState<Period>("month");
  const [activePoint, setActivePoint] = useState<ScorePoint | null>(null);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMobile = useIsMobile();
  const { trigger } = useHaptic();

  const clearRevertTimer = () => {
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
  };

  useEffect(() => clearRevertTimer, []);

  // Compute the full daily series once; switching periods only reslices the tail.
  const fullSeries = useMemo(
    () => computeScores(habit, entries),
    [habit, entries],
  );
  const slice = PERIOD_SLICE[period];
  const data: ScorePoint[] = fullSeries.slice(-slice).map((d) => ({
    date: d.date,
    score: Math.round(d.value * 100),
  }));

  const gradientId = `scoreGradient-${habit.id}`;

  const handleChartMove = (state: { activeTooltipIndex?: unknown }) => {
    clearRevertTimer();
    if (typeof state?.activeTooltipIndex === "number") {
      const point = data[state.activeTooltipIndex];
      if (point && point.date !== activePoint?.date) {
        setActivePoint(point);
        if (isMobile) {
          trigger("tick");
        }
      }
    }
  };

  const handleChartLeave = () => {
    clearRevertTimer();
    revertTimerRef.current = setTimeout(() => {
      setActivePoint(null);
    }, 2500);
  };

  const handlePeriodChange = (next: string) => {
    if (!isPeriod(next)) return;
    clearRevertTimer();
    setActivePoint(null);
    setPeriod(next);
  };

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
      <div className="flex items-center justify-between gap-2 min-h-7">
        <Tabs value={period} onValueChange={handlePeriodChange}>
          <TabsList variant="card" size="xs">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>

        {activePoint && (
          <div
            data-testid="score-chart-readout"
            className="text-xs sm:text-sm font-medium text-foreground tabular-nums animate-in fade-in duration-150 flex items-center"
          >
            <span className="text-muted-foreground">
              {format(parseISO(activePoint.date), "MMM d")}
            </span>
            <span className="text-muted-foreground mx-1.5">·</span>
            <span className="font-semibold" style={{ color: habit.color }}>
              {activePoint.score}% Score
            </span>
          </div>
        )}
      </div>

      <div className="w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            onMouseMove={handleChartMove}
            onTouchStart={handleChartMove}
            onTouchMove={handleChartMove}
            onMouseLeave={handleChartLeave}
            onTouchEnd={handleChartLeave}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={habit.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={habit.color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
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
              cursor={{
                stroke: "hsl(var(--border))",
                strokeWidth: 1,
                strokeDasharray: "2 2",
              }}
              content={() => null}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke={habit.color}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: habit.color,
                stroke: "hsl(var(--background))",
                strokeWidth: 2,
              }}
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
