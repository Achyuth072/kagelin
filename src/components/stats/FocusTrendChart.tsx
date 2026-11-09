"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { computeTickInterval } from "@/lib/utils/chart-ticks";
import {
  aggregateTrendData,
  type AggregatedTrendPoint,
  type TrendDataPoint,
} from "@/lib/utils/chart-aggregation";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { EmptyState } from "@/components/ui/EmptyState";
import { LineChart as LineChartIcon } from "lucide-react";
import type { StatsPeriod } from "@/lib/types/stats";

interface FocusTrendChartProps {
  data: TrendDataPoint[];
  periodLabel?: string;
  period?: StatsPeriod;
  className?: string;
}

export function FocusTrendChart({
  data,
  periodLabel = "Last 7 days (ends today)",
  period = "7d",
  className,
}: FocusTrendChartProps) {
  const hasData = data.some((d) => d.hours > 0 || d.tasksCompleted > 0);
  const isMobile = useIsMobile();
  const { trigger } = useHaptic();

  const [activePoint, setActivePoint] = useState<AggregatedTrendPoint | null>(
    null,
  );
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRevertTimer = () => {
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
  };

  useEffect(() => clearRevertTimer, []);

  const chartData = useMemo(
    () => aggregateTrendData(data, period),
    [data, period],
  );

  // Avoid an unreadable tick per bucket once the range grows.
  // Mobile has roughly half the plot width, so target half as many labels.
  const tickInterval = computeTickInterval(chartData.length, isMobile ? 4 : 8);

  const handleChartMove = (state: { activeTooltipIndex?: unknown }) => {
    if (typeof state?.activeTooltipIndex === "number") {
      const point = chartData[state.activeTooltipIndex];
      if (point && point.date !== activePoint?.date) {
        clearRevertTimer();
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
    }, 1500);
  };

  return (
    <Card className={cn("p-4 sm:p-6 border-border/50", className)}>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Trend
            </h3>
            {activePoint ? (
              <p
                data-testid="scrub-readout"
                className="text-sm font-medium text-foreground mt-1 tabular-nums animate-in fade-in duration-150"
              >
                <span className="text-muted-foreground mr-1.5">
                  {activePoint.tooltipLabel}:
                </span>
                <span className="text-brand font-semibold">
                  {activePoint.hours}h
                </span>
                <span className="text-muted-foreground mx-1.5">•</span>
                <span>
                  {activePoint.tasksCompleted}{" "}
                  {activePoint.tasksCompleted === 1 ? "task" : "tasks"}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                {periodLabel} focus and task trend
              </p>
            )}
          </div>
          {hasData && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand" />
                Focus hours
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/60" />
                Tasks completed
              </span>
            </div>
          )}
        </div>

        {!hasData ? (
          <EmptyState
            icon={LineChartIcon}
            title="No activity yet"
            description="Complete a focus session or task to see your trend here."
            className="py-8 gap-3"
          />
        ) : (
          <div className="w-full min-w-0 overflow-hidden">
            <div className="sr-only">
              <table className="sr-only">
                <caption className="sr-only">
                  {periodLabel} Focus and Task Trend Summary
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Focus Hours</th>
                    <th scope="col">Tasks Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((d) => (
                    <tr key={d.date}>
                      <td>{d.label}</td>
                      <td>{d.hours} hours</td>
                      <td>{d.tasksCompleted} tasks</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ResponsiveContainer width="100%" height={isMobile ? 230 : 200}>
              <ComposedChart
                data={chartData}
                margin={{
                  top: 12,
                  right: 0,
                  bottom: 0,
                  left: isMobile ? -6 : 0,
                }}
                onMouseMove={handleChartMove}
                onTouchMove={handleChartMove}
                onMouseLeave={handleChartLeave}
                onTouchEnd={handleChartLeave}
              >
                <defs>
                  <linearGradient
                    id="focusGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={isMobile ? 11 : 12}
                  tickLine={false}
                  axisLine={false}
                  interval={tickInterval}
                  tickMargin={10}
                />
                <YAxis
                  yAxisId="hours"
                  width={isMobile ? 28 : 36}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={isMobile ? 11 : 12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}h`}
                />
                <YAxis
                  yAxisId="tasks"
                  orientation="right"
                  width={isMobile ? 22 : 28}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={isMobile ? 11 : 12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{
                    stroke: "hsl(var(--border))",
                    strokeWidth: 1,
                    strokeDasharray: "2 2",
                  }}
                  content={isMobile ? () => null : undefined}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  labelFormatter={(_label, payload) =>
                    payload?.[0]?.payload?.tooltipLabel || _label
                  }
                  formatter={(value, name) => [
                    value,
                    name === "hours" ? "Focus hours" : "Tasks completed",
                  ]}
                />
                <Area
                  yAxisId="hours"
                  type="monotone"
                  dataKey="hours"
                  fill="url(#focusGradient)"
                  stroke="none"
                  isAnimationActive={false}
                  tooltipType="none"
                  legendType="none"
                />
                <Line
                  yAxisId="hours"
                  type="monotone"
                  dataKey="hours"
                  stroke="hsl(var(--brand))"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="tasks"
                  type="monotone"
                  dataKey="tasksCompleted"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
