"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS: Record<number, string> = {
  0: "12a",
  6: "6a",
  12: "12p",
  18: "6p",
};

interface TimeOfDayHeatmapProps {
  /** Minutes of focus, indexed [weekday(0=Mon)][hour(0-23)]. */
  matrix: number[][];
  className?: string;
}

export function TimeOfDayHeatmap({ matrix, className }: TimeOfDayHeatmapProps) {
  const { maxMinutes, hasData } = useMemo(() => {
    let max = 0;
    let any = false;
    for (const row of matrix) {
      for (const minutes of row) {
        if (minutes > 0) any = true;
        if (minutes > max) max = minutes;
      }
    }
    return { maxMinutes: max, hasData: any };
  }, [matrix]);

  return (
    <Card className={cn("p-6 border-border/50 overflow-hidden", className)}>
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Focus by Time of Day
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            When you focus most, by hour and weekday
          </p>
        </div>

        {!hasData ? (
          <EmptyState
            icon={Clock}
            title="No focus sessions yet"
            description="Complete a focus session to see your patterns here."
            className="py-8 gap-3"
          />
        ) : (
          <div className="overflow-x-auto custom-scrollbar pb-2">
            <div
              className="grid gap-1 w-full"
              style={{
                gridTemplateColumns: "auto repeat(24, minmax(18px, 1fr))",
              }}
            >
              <div />
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  className="text-center text-[11px] text-muted-foreground"
                >
                  {HOUR_LABELS[hour] ?? ""}
                </div>
              ))}

              {matrix.map((row, weekday) => (
                <TimeOfDayRow
                  key={weekday}
                  weekday={WEEKDAYS[weekday]}
                  minutesByHour={row}
                  maxMinutes={maxMinutes}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TimeOfDayRow({
  weekday,
  minutesByHour,
  maxMinutes,
}: {
  weekday: string;
  minutesByHour: number[];
  maxMinutes: number;
}) {
  return (
    <>
      <div className="flex items-center text-[11px] text-muted-foreground pr-1">
        {weekday}
      </div>
      {minutesByHour.map((minutes, hour) => {
        const ratio = maxMinutes > 0 ? minutes / maxMinutes : 0;
        const size =
          minutes === 0 ? 6 : Math.max(6, Math.round(6 + ratio * 12));
        const opacity = minutes === 0 ? 0.15 : 0.2 + ratio * 0.8;
        const label = `${weekday} ${String(hour).padStart(2, "0")}:00 — ${minutes}m`;

        return (
          <div
            key={hour}
            className="flex items-center justify-center"
            title={label}
            aria-label={label}
          >
            <div
              className="rounded-full"
              style={{
                width: size,
                height: size,
                backgroundColor: "hsl(var(--brand))",
                opacity,
              }}
            />
          </div>
        );
      })}
    </>
  );
}
