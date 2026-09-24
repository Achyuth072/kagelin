"use client";

import React from "react";
import {
  ActivityCalendar,
  type Activity,
  type BlockElement,
} from "react-activity-calendar";
import "react-activity-calendar/tooltips.css";
import { useTheme } from "next-themes";
import { subMonths, format } from "date-fns";
import { ENTRY_VALUE_SKIPPED, type Habit } from "@/lib/types/habit";
import { dayValue } from "@/lib/utils/habit-score";

interface HabitHeatmapProps {
  entries: Array<{ date: string; value: number }>;
  color: string;
  className?: string;
  blockSize?: number;
  blockMargin?: number;
  startDate?: string;
  /** Omit for non-habit history (e.g. task series) — shades as Boolean. */
  habit?: Pick<Habit, "habit_type" | "target_type" | "target_value">;
}

function renderBlock(block: BlockElement, activity: Activity, color: string) {
  if (activity.level !== 0) return block;
  return React.cloneElement(block, {
    // Inset so the stroke stays inside the SVG viewBox at the edges.
    x: (block.props.x as number) + 0.5,
    y: (block.props.y as number) + 0.5,
    width: (block.props.width as number) - 1,
    height: (block.props.height as number) - 1,
    style: {
      ...block.props.style,
      stroke:
        activity.count === ENTRY_VALUE_SKIPPED
          ? color
          : "hsl(var(--border) / 0.5)",
      strokeWidth: 1,
    },
  });
}

export function HabitHeatmap({
  entries,
  color,
  className,
  blockSize = 9,
  blockMargin = 2,
  startDate,
  habit = {},
}: HabitHeatmapProps) {
  const { resolvedTheme } = useTheme();

  const today = new Date().toISOString().split("T")[0];
  const dataMap = new Map(entries.map((e) => [e.date, e.value]));

  // The calendar spans only first→last date; pin both edges so a new habit still gets a full year.
  const paddedDays = new Set<string>();
  const ensureDay = (date: string) => {
    if (dataMap.has(date)) return;
    dataMap.set(date, 0);
    paddedDays.add(date);
  };
  if (startDate) ensureDay(startDate);
  ensureDay(today);
  ensureDay(format(subMonths(new Date(), 12), "yyyy-MM-dd"));

  const calendarData = Array.from(dataMap.entries())
    .map(([date, value]) => {
      // A padded day has no entry; scoring its 0 would read as "met" for an at_most habit.
      const progress = paddedDays.has(date) ? 0 : dayValue(value, habit);
      return {
        date,
        count: value,
        // Any progress gets at least the lightest shade; only a met target gets the darkest.
        level: progress <= 0 ? 0 : Math.max(1, Math.floor(progress * 4)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

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
        renderBlock={(block, activity) => renderBlock(block, activity, color)}
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
