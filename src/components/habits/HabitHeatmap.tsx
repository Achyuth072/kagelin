"use client";

import React from "react";
import { ActivityCalendar } from "react-activity-calendar";
import "react-activity-calendar/tooltips.css";
import { useTheme } from "next-themes";
import { subMonths, format } from "date-fns";

interface HabitHeatmapProps {
  entries: Array<{ date: string; value: number }>;
  color: string;
  className?: string;
  blockSize?: number;
  blockMargin?: number;
  startDate?: string;
}

/** GitHub-style habit activity heatmap, monochromatic on the habit color. */
export function HabitHeatmap({
  entries,
  color,
  className,
  blockSize = 9,
  blockMargin = 2,
  startDate,
}: HabitHeatmapProps) {
  const { resolvedTheme } = useTheme();

  const today = new Date().toISOString().split("T")[0];
  const dataMap = new Map(entries.map((e) => [e.date, e.value]));

  // The calendar only fills gaps *between* its first and last date, so pin the
  // edges ourselves. The 6-months-back floor keeps today at the right with empty
  // cells to its left; longer habits keep their own earlier start and scroll.
  const ensureDay = (date: string) => {
    if (!dataMap.has(date)) dataMap.set(date, 0);
  };
  if (startDate) ensureDay(startDate);
  ensureDay(today);
  ensureDay(format(subMonths(new Date(), 6), "yyyy-MM-dd"));

  const calendarData = Array.from(dataMap.entries())
    .map(([date, value]) => ({
      date,
      count: value,
      level: value === 0 ? 0 : Math.min(Math.ceil(value * 4), 4),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Generate monochromatic theme from base to habit color
  const theme = {
    dark: ["#262626", `${color}33`, `${color}66`, `${color}99`, color],
    light: ["#ebebeb", `${color}33`, `${color}66`, `${color}99`, color],
  };

  return (
    <div className={className} style={{ width: "fit-content" }}>
      <ActivityCalendar
        data={calendarData}
        theme={theme}
        colorScheme={(resolvedTheme as "light" | "dark") || "light"}
        blockSize={blockSize}
        blockMargin={blockMargin}
        blockRadius={2}
        fontSize={12}
        showColorLegend={false}
        showMonthLabels={false}
        showTotalCount={false}
        labels={{
          months: [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ],
          weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          totalCount: "{{count}} completions in {{year}}",
          legend: {
            less: "Less",
            more: "More",
          },
        }}
      />
    </div>
  );
}
