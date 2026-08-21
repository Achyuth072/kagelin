"use client";

import { useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AdminMetricsSummary } from "@/lib/admin/metricsQueries";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Smartphone,
  AppWindow,
  Timer,
  CheckCircle2,
  Hourglass,
  UserCheck,
  Activity,
  ShieldCheck,
  Clock,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

interface MetricsDashboardProps {
  summary: AdminMetricsSummary;
  adminEmail?: string;
}

type TimeRange = "7d" | "30d" | "all";

function filterTrends(
  dailyTrends: AdminMetricsSummary["dailyTrends"],
  timeRange: TimeRange,
) {
  if (!dailyTrends || dailyTrends.length === 0) return [];
  if (timeRange === "7d") return dailyTrends.slice(-7);
  if (timeRange === "30d") return dailyTrends.slice(-30);
  return dailyTrends;
}

function safeFormatDate(dateStr: string, formatStr: string): string {
  try {
    return format(parseISO(dateStr), formatStr);
  } catch {
    return dateStr;
  }
}

const PERIOD_TRIGGER_CLASS =
  "rounded-md px-3.5 h-8 text-xs font-medium tracking-tight border border-transparent text-muted-foreground transition-seijaku-fast hover:text-foreground hover:bg-secondary/40 data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:border-brand/20 data-[state=active]:shadow-none";

const CHART_AXIS_PROPS = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "hsl(var(--foreground))" },
};

interface KpiCardProps {
  label: string;
  value: ReactNode;
  subtext: ReactNode;
  icon: LucideIcon;
}

function KpiCard({ label, value, subtext, icon: Icon }: KpiCardProps) {
  return (
    <Card className="p-5 border-border/70 bg-card">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="text-3xl font-semibold tracking-[-0.02em] font-mono text-foreground">
            {value}
          </p>
          <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            {subtext}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-secondary text-foreground/70 shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </Card>
  );
}

export function MetricsDashboard({
  summary,
  adminEmail,
}: MetricsDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const { kpis, dailyTrends, hasData, generatedAt } = summary;

  const filteredTrends = filterTrends(dailyTrends, timeRange);
  const formattedGeneratedAt = safeFormatDate(
    generatedAt,
    "MMM d, yyyy HH:mm:ss",
  );

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] text-foreground">
              Operator Metrics
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand/10 text-brand border border-brand/20">
              <ShieldCheck className="w-3 h-3" />
              Admin
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Anonymous zero-PII telemetry, feature adoption, and engagement
            rollups.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {adminEmail && (
            <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 py-1 rounded-md border border-border/40 font-mono">
              <span className="text-foreground/80">{adminEmail}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-secondary/30 px-2.5 py-1 rounded-md border border-border/30">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Updated: {formattedGeneratedAt}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Active Devices"
          value={kpis.activeDevicesToday}
          icon={Smartphone}
          subtext={
            <>
              <span>
                7d:{" "}
                <strong className="text-foreground font-mono">
                  {kpis.activeDevices7d}
                </strong>
              </span>
              <span>•</span>
              <span>
                30d:{" "}
                <strong className="text-foreground font-mono">
                  {kpis.activeDevices30d}
                </strong>
              </span>
            </>
          }
        />

        <KpiCard
          label="PWA Adoption Rate"
          value={`${kpis.pwaRatioPercent}%`}
          icon={AppWindow}
          subtext={
            <>
              <span>
                {kpis.totalPwaDevices} PWA / {kpis.totalBrowserDevices} Web
              </span>
              <span>({kpis.totalPwaInstalls} installs)</span>
            </>
          }
        />

        <KpiCard
          label="Total Focus Time"
          value={`${kpis.totalFocusHours}h`}
          icon={Timer}
          subtext={
            <span>
              Today:{" "}
              <strong className="text-foreground font-mono">
                {kpis.focusHoursToday}h
              </strong>{" "}
              logged
            </span>
          }
        />

        <KpiCard
          label="Tasks Completed"
          value={kpis.totalTasksCompleted}
          icon={CheckCircle2}
          subtext={
            <>
              <span>{kpis.totalTasksCreated} created</span>
              <span>({kpis.taskCompletionRatePercent}% completion)</span>
            </>
          }
        />

        <KpiCard
          label="Timer Completion Rate"
          value={`${kpis.timerCompletionRatePercent}%`}
          icon={Hourglass}
          subtext={
            <>
              <span>{kpis.totalTimerCompleted} done</span>
              <span>•</span>
              <span>{kpis.totalTimerAbandoned} abandoned</span>
            </>
          }
        />

        <KpiCard
          label="Registered Signups"
          value={kpis.totalSignups}
          icon={UserCheck}
          subtext={<span>{kpis.totalHabitsLogged} total habit check-ins</span>}
        />
      </div>

      {/* Main Charts Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              Trend Analytics
            </h2>
            <p className="text-xs text-muted-foreground">
              Historical activity aggregated daily.
            </p>
          </div>

          <Tabs
            value={timeRange}
            onValueChange={(val) => setTimeRange(val as TimeRange)}
          >
            <TabsList className="inline-flex bg-secondary/20 p-1 rounded-lg h-10 border border-border/40">
              <TabsTrigger value="7d" className={PERIOD_TRIGGER_CLASS}>
                7 Days
              </TabsTrigger>
              <TabsTrigger value="30d" className={PERIOD_TRIGGER_CLASS}>
                30 Days
              </TabsTrigger>
              <TabsTrigger value="all" className={PERIOD_TRIGGER_CLASS}>
                All History
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {!hasData ? (
          <Card className="p-10 border-border/50">
            <EmptyState
              icon={Activity}
              title="No telemetry recorded yet"
              description="When consented users interact with Kagelin, daily aggregate metrics and device trends will appear here."
              className="py-6"
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Daily Active Devices */}
            <Card className="p-6 border-border/60 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Daily Active Devices
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PWA standalone vs browser launches
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand" />
                    PWA
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/60" />
                    Browser
                  </span>
                </div>
              </div>

              <div className="w-full min-w-0 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={filteredTrends}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  >
                    <XAxis
                      dataKey="date"
                      {...CHART_AXIS_PROPS}
                      minTickGap={20}
                      tickFormatter={(d: string) => safeFormatDate(d, "MMM d")}
                    />
                    <YAxis
                      {...CHART_AXIS_PROPS}
                      width={30}
                      allowDecimals={false}
                    />
                    <Tooltip {...CHART_TOOLTIP_PROPS} />
                    <Area
                      type="monotone"
                      dataKey="pwaDevices"
                      name="PWA Devices"
                      stackId="1"
                      stroke="hsl(var(--brand))"
                      fill="hsl(var(--brand))"
                      fillOpacity={0.25}
                      strokeWidth={1.75}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="browserDevices"
                      name="Browser Devices"
                      stackId="1"
                      stroke="hsl(var(--muted-foreground))"
                      fill="hsl(var(--muted-foreground))"
                      fillOpacity={0.15}
                      strokeWidth={1.75}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Chart 2: Task Throughput & Focus Hours */}
            <Card className="p-6 border-border/60 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Task Throughput & Focus
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tasks created, completed, and focus hours
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-brand" />
                    Focus (hrs)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/80" />
                    Completed
                  </span>
                </div>
              </div>

              <div className="w-full min-w-0 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={filteredTrends}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  >
                    <XAxis
                      dataKey="date"
                      {...CHART_AXIS_PROPS}
                      minTickGap={20}
                      tickFormatter={(d: string) => safeFormatDate(d, "MMM d")}
                    />
                    <YAxis
                      yAxisId="hours"
                      {...CHART_AXIS_PROPS}
                      width={32}
                      tickFormatter={(v) => `${v}h`}
                    />
                    <YAxis
                      yAxisId="tasks"
                      orientation="right"
                      {...CHART_AXIS_PROPS}
                      width={28}
                      allowDecimals={false}
                    />
                    <Tooltip {...CHART_TOOLTIP_PROPS} />
                    <Line
                      yAxisId="hours"
                      type="monotone"
                      dataKey="focusHours"
                      name="Focus Hours"
                      stroke="hsl(var(--brand))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="tasks"
                      type="monotone"
                      dataKey="tasksCompleted"
                      name="Tasks Completed"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-2 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/70" />
          <span>
            Calculated from zero-PII client telemetry & daily database rollups.
          </span>
        </div>
        <div>
          <span>Retained events TTL: 30 days. Daily aggregates permanent.</span>
        </div>
      </div>
    </div>
  );
}
