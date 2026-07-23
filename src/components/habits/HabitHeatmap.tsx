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

  // Calendar only fills gaps *between* first/last date — pin the edges so new
  // habits get a full 12-month-wide grid instead of a stub a few days wide.
  const ensureDay = (date: string) => {
    if (!dataMap.has(date)) dataMap.set(date, 0);
  };
  if (startDate) ensureDay(startDate);
  ensureDay(today);
  ensureDay(format(subMonths(new Date(), 12), "yyyy-MM-dd"));

  const calendarData = Array.from(dataMap.entries())
    .map(([date, value]) => ({
      date,
      count: value,
      level: value === 0 ? 0 : Math.min(Math.ceil(value * 4), 4),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const theme = {
    dark: ["#262626", `${color}33`, `${color}66`, `${color}99`, color],
    light: ["#ebebeb", `${color}33`, `${color}66`, `${color}99`, color],
  };

  return (
    // fit-content: natural blockSize, no stretching; callers scroll it into view.
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
