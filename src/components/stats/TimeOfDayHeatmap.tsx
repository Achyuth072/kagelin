"use client";

import { useState } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatHeaderHour(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour > 12 ? `${hour - 12}p` : `${hour}a`;
}

function formatCellHour(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour === 12) return "12:00 PM";
  return hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
}

function getIntensityLevel(minutes: number): number {
  if (minutes === 0) return 0;
  if (minutes <= 20) return 1;
  if (minutes <= 40) return 2;
  if (minutes <= 60) return 3;
  return 4;
}

const INTENSITY_CLASSES: Record<number, string> = {
  0: "bg-secondary/40 border border-border/30 hover:bg-secondary/70",
  1: "bg-brand/20 hover:bg-brand/35",
  2: "bg-brand/45 hover:bg-brand/60",
  3: "bg-brand/70 hover:bg-brand/85",
  4: "bg-brand hover:bg-brand/90 text-white",
};

interface SelectedCell {
  day: string;
  hour: number;
  minutes: number;
}

interface TimeOfDayHeatmapProps {
  /** Minutes of focus, indexed [weekday(0=Mon)][hour(0-23)]. */
  matrix: number[][];
  className?: string;
}

export function TimeOfDayHeatmap({ matrix, className }: TimeOfDayHeatmapProps) {
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const hasData = matrix.some((row) => row.some((minutes) => minutes > 0));

  const readoutText = selectedCell
    ? `${selectedCell.day} at ${formatCellHour(selectedCell.hour)} — ${selectedCell.minutes}m focus`
    : "When you focus most, by hour and weekday";

  return (
    <Card
      className={cn(
        "p-4 sm:p-5 rounded-xl border border-border bg-card space-y-3",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Focus by Time of Day
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>{readoutText}</span>
            {selectedCell && (
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/40 border border-border/50"
                title="Reset selection"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Reset</span>
              </button>
            )}
          </p>
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          icon={Clock}
          title="No focus sessions yet"
          description="Complete a focus session to see your patterns here."
          className="py-8 gap-3"
        />
      ) : (
        <>
          <div className="w-full overflow-x-auto pb-1.5 touch-pan-x custom-scrollbar">
            <div
              className="grid gap-1 w-full min-w-[480px] md:min-w-0"
              style={{
                gridTemplateColumns: "32px repeat(24, minmax(16px, 1fr))",
              }}
            >
              {/* Hour Header Row */}
              <span className="sticky left-0 bg-card z-10" />
              {Array.from({ length: 24 }).map((_, hour) => {
                const isMajor = hour % 3 === 0;
                return (
                  <div
                    key={hour}
                    className="text-center text-[10px] font-mono text-muted-foreground/60 select-none"
                  >
                    {isMajor ? (
                      <span>{formatHeaderHour(hour)}</span>
                    ) : (
                      <span className="text-[8px] opacity-25">·</span>
                    )}
                  </div>
                );
              })}

              {/* 24-Hour Weekday Rows */}
              {WEEKDAYS.map((day, dayIdx) => (
                <div key={day} className="contents">
                  <span className="flex items-center text-[11px] font-mono text-muted-foreground sticky left-0 bg-card z-10 pr-1 select-none">
                    {day}
                  </span>
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const minutes = matrix[dayIdx]?.[hour] ?? 0;
                    const level = getIntensityLevel(minutes);
                    const bgClass = INTENSITY_CLASSES[level];
                    const formattedHour = formatCellHour(hour);

                    return (
                      <button
                        key={hour}
                        type="button"
                        onClick={() =>
                          setSelectedCell({
                            day,
                            hour,
                            minutes,
                          })
                        }
                        className={cn(
                          "w-full h-4.5 sm:h-5 md:h-5.5 min-w-[16px] rounded-[3px] transition-transform hover:scale-110 hover:z-10 relative focus-visible:ring-1 focus-visible:ring-brand flex items-center justify-center",
                          bgClass,
                        )}
                        title={`${day} ${formattedHour}: ${minutes}m`}
                        aria-label={`${day} ${formattedHour}: ${minutes}m focus`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/70 pt-0.5">
            <span className="sm:hidden">← Swipe runway for all 24h →</span>
            <span className="hidden sm:inline">
              24-hour calibrated runway • 100% full width
            </span>
            <span>Intensity: 0m → 60m+</span>
          </div>
        </>
      )}
    </Card>
  );
}
