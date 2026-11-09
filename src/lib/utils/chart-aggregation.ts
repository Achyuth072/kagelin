import {
  format,
  parseISO,
  isSameDay,
  startOfWeek,
  isSameWeek,
  startOfMonth,
  isSameMonth,
} from "date-fns";
import type { StatsPeriod } from "@/lib/types/stats";

export type TrendGranularity = "day" | "week" | "month";

export interface TrendDataPoint {
  date: string;
  hours: number;
  tasksCompleted: number;
}

export interface AggregatedTrendPoint {
  date: string;
  label: string;
  tooltipLabel: string;
  hours: number;
  tasksCompleted: number;
  isCurrent: boolean;
}

export function getTrendGranularity(period: StatsPeriod): TrendGranularity {
  switch (period) {
    case "7d":
    case "30d":
      return "day";
    case "90d":
      return "week";
    case "1y":
    case "all":
      return "month";
  }
}

interface Bucket {
  startDate: Date;
  hours: number;
  tasksCompleted: number;
}

function bucketTrendData(
  data: TrendDataPoint[],
  getStartDate: (date: Date) => Date,
): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>();

  for (const d of data) {
    const startDate = getStartDate(parseISO(d.date));
    const key = format(startDate, "yyyy-MM-dd");

    const existing = buckets.get(key);
    if (existing) {
      existing.hours += d.hours;
      existing.tasksCompleted += d.tasksCompleted;
    } else {
      buckets.set(key, {
        startDate,
        hours: d.hours,
        tasksCompleted: d.tasksCompleted,
      });
    }
  }

  return buckets;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function aggregateTrendData(
  data: TrendDataPoint[],
  period: StatsPeriod,
  now: Date = new Date(),
): AggregatedTrendPoint[] {
  const granularity = getTrendGranularity(period);

  if (granularity === "day") {
    return data.map((d) => {
      const parsed = parseISO(d.date);
      const isCurrent = isSameDay(parsed, now);
      return {
        date: d.date,
        label: format(parsed, "MMM d"),
        tooltipLabel: format(parsed, "EEE, MMM d, yyyy"),
        hours: d.hours,
        tasksCompleted: d.tasksCompleted,
        isCurrent,
      };
    });
  }

  if (granularity === "week") {
    const buckets = bucketTrendData(data, (date) =>
      startOfWeek(date, { weekStartsOn: 1 }),
    );

    return Array.from(buckets.entries()).map(([key, bucket]) => {
      const isCurrent = isSameWeek(bucket.startDate, now, { weekStartsOn: 1 });
      const baseLabel = `Week of ${format(bucket.startDate, "MMM d, yyyy")}`;
      return {
        date: key,
        label: format(bucket.startDate, "MMM d"),
        tooltipLabel: isCurrent ? `${baseLabel} (this week)` : baseLabel,
        hours: roundToOneDecimal(bucket.hours),
        tasksCompleted: bucket.tasksCompleted,
        isCurrent,
      };
    });
  }

  if (granularity === "month") {
    const buckets = bucketTrendData(data, startOfMonth);
    const bucketEntries = Array.from(buckets.entries());
    const monthNames = bucketEntries.map(([, b]) => format(b.startDate, "MMM"));
    const hasMonthCollision = new Set(monthNames).size < monthNames.length;

    return bucketEntries.map(([key, bucket]) => {
      const isCurrent = isSameMonth(bucket.startDate, now);
      const baseLabel = format(bucket.startDate, "MMMM yyyy");
      const label = hasMonthCollision
        ? format(bucket.startDate, "MMM ''yy")
        : format(bucket.startDate, "MMM");

      return {
        date: key,
        label,
        tooltipLabel: isCurrent ? `${baseLabel} (this month)` : baseLabel,
        hours: roundToOneDecimal(bucket.hours),
        tasksCompleted: bucket.tasksCompleted,
        isCurrent,
      };
    });
  }

  return [];
}
