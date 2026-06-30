"use client";

import { useMemo } from "react";
import {
  format,
  parseISO,
  subMonths,
  startOfMonth,
  eachMonthOfInterval,
} from "date-fns";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import { dayValue } from "@/lib/utils/habit-score";
import { BarChart3 } from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface HabitFrequencyGridProps {
  habit: Habit;
  entries: HabitEntry[];
}

export function HabitFrequencyGrid({
  habit,
  entries,
}: HabitFrequencyGridProps) {
  const { matrix, months, maxCount } = useMemo(() => {
    if (entries.length === 0)
      return { matrix: [], months: [] as string[], maxCount: 0 };

    const today = new Date();
    const monthStarts = eachMonthOfInterval({
      start: subMonths(startOfMonth(today), 11),
      end: startOfMonth(today),
    });

    const months = monthStarts.map((m) => format(m, "MMM"));

    // "yyyy-MM" → column index, computed once so the per-entry loop is O(1).
    const monthIndexByKey = new Map<string, number>();
    monthStarts.forEach((m, i) => monthIndexByKey.set(format(m, "yyyy-MM"), i));

    // Build count map: "weekdayIndex-monthIndex" → count
    // weekdayIndex: 0=Mon ... 6=Sun (ISO), monthIndex: 0..11
    // A day counts as "done" using the shared dayValue predicate so measurable
    // habits (at_least / at_most) agree with the Score engine and Overview card.
    const counts = new Map<string, number>();

    for (const e of entries) {
      if (dayValue(e.value, habit) < 1) continue;
      const d = parseISO(e.date);
      const weekday = (d.getDay() + 6) % 7; // Mon=0, Sun=6
      const monthIdx = monthIndexByKey.get(format(d, "yyyy-MM"));
      if (monthIdx === undefined) continue;
      const key = `${weekday}-${monthIdx}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    let maxCount = 0;
    const matrix: number[][] = [];
    for (let wd = 0; wd < 7; wd++) {
      const row: number[] = [];
      for (let mi = 0; mi < monthStarts.length; mi++) {
        const c = counts.get(`${wd}-${mi}`) ?? 0;
        row.push(c);
        if (c > maxCount) maxCount = c;
      }
      matrix.push(row);
    }

    return { matrix, months, maxCount };
  }, [entries, habit]);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No frequency data"
        description="Log this habit to see frequency patterns."
        className="py-8 gap-3"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `auto repeat(${months.length}, minmax(24px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div />
        {months.map((m) => (
          <div
            key={m}
            className="text-center text-[11px] text-muted-foreground"
          >
            {m}
          </div>
        ))}

        {/* Data rows */}
        {matrix.map((row, wd) => (
          <FrequencyRow
            key={wd}
            weekday={WEEKDAYS[wd]}
            counts={row}
            maxCount={maxCount}
            color={habit.color}
          />
        ))}
      </div>
    </div>
  );
}

function FrequencyRow({
  weekday,
  counts,
  maxCount,
  color,
}: {
  weekday: string;
  counts: number[];
  maxCount: number;
  color?: string;
}) {
  return (
    <>
      <div className="flex items-center text-[11px] text-muted-foreground pr-1">
        {weekday}
      </div>
      {counts.map((c, i) => {
        const ratio = maxCount > 0 ? c / maxCount : 0;
        const size = c === 0 ? 6 : Math.max(6, Math.round(6 + ratio * 16));
        const opacity = c === 0 ? 0.15 : 0.2 + ratio * 0.8;

        return (
          <div key={i} className="flex items-center justify-center">
            <div
              className="rounded-full"
              style={{
                width: size,
                height: size,
                backgroundColor: color ?? "hsl(var(--brand))",
                opacity,
              }}
            />
          </div>
        );
      })}
    </>
  );
}
