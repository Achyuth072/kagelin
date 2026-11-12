"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Clock, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCurrentTime } from "@/lib/hooks/useCurrentTime";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_START_HOUR = 6;
const DEFAULT_SCROLL_HOUR = 8;
const STICKY_LABEL_OFFSET_PX = 36; // 32px sticky label + 4px grid gap

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

/**
 * Determines the target hour column to auto-scroll into view on mobile.
 * Prioritizes daytime focus hours (6 AM - 11 PM) with 1h leading context,
 * capped at 8 AM so daytime context is preserved without overshooting into evening.
 * Falls back to night-shift focus if the user exclusively focuses overnight,
 * or default 8 AM (start of standard workday).
 */
export function getTargetScrollHour(matrix: number[][]): number {
  const hourlyTotals = Array.from({ length: 24 }, (_, h) =>
    matrix.reduce((sum, row) => sum + (row[h] ?? 0), 0),
  );

  // Check for daytime focus activity (6 AM to 11 PM)
  const daytimeHour = hourlyTotals.findIndex(
    (mins, h) => h >= DAY_START_HOUR && mins > 0,
  );
  if (daytimeHour !== -1) {
    return Math.min(Math.max(0, daytimeHour - 1), DEFAULT_SCROLL_HOUR);
  }

  // Pure night owls (only work between 12 AM and 5 AM)
  const nightHour = hourlyTotals.findIndex((mins) => mins > 0);
  if (nightHour !== -1) {
    return Math.max(0, nightHour - 1);
  }

  return DEFAULT_SCROLL_HOUR;
}

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
  const [focusPos, setFocusPos] = useState({ day: 0, hour: 0 });
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollRef = useHorizontalScroll();
  const hasAutoScrolled = useRef(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isMobile = useIsMobile();
  const currentTime = useCurrentTime();
  // Safe against SSR hydration mismatch: only identify current hour after client hydration
  const currentHour = mounted ? currentTime.getHours() : null;

  // Combine refs: useHorizontalScroll for desktop wheel/drag, manual ref for mobile auto-scroll
  const setScrollContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!isMobile) {
        horizontalScrollRef(node);
      } else {
        horizontalScrollRef(null);
      }
      scrollContainerRef.current = node;
    },
    [horizontalScrollRef, isMobile],
  );

  const focusCell = (day: number, hour: number) => {
    setFocusPos({ day, hour });
    gridRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-day="${day}"][data-hour="${hour}"]`,
      )
      ?.focus();
  };

  const hasData = matrix.some((row) => row.some((minutes) => minutes > 0));

  // Auto-scroll on mobile to the user's active focus window on mount
  useLayoutEffect(() => {
    if (!isMobile || hasAutoScrolled.current || !hasData) return;

    const frame = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const targetHour = getTargetScrollHour(matrix);
      const targetCell = container.querySelector<HTMLElement>(
        `[data-hour="${targetHour}"]`,
      );
      if (!targetCell) return;

      const containerRect = container.getBoundingClientRect();
      const cellRect = targetCell.getBoundingClientRect();
      const targetScrollLeft = Math.max(
        0,
        container.scrollLeft +
          (cellRect.left - containerRect.left) -
          STICKY_LABEL_OFFSET_PX,
      );

      container.scrollLeft = targetScrollLeft;
      hasAutoScrolled.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [isMobile, hasData, matrix]);

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
          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
            <span>{readoutText}</span>
            {selectedCell && (
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/40 border border-border/50"
                title="Reset selection"
              >
                <RotateCcw className="h-2.5 w-2.5" strokeWidth={2.25} />
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
          <div
            ref={setScrollContainerRef}
            data-testid="time-of-day-scroller"
            className="w-full overflow-x-auto pb-1.5 touch-pan-x custom-scrollbar"
          >
            <div
              ref={gridRef}
              className="grid gap-1 w-full min-w-[480px] md:min-w-0"
              style={{
                gridTemplateColumns: "32px repeat(24, minmax(16px, 1fr))",
              }}
            >
              {/* Hour Header Row */}
              <span className="sticky left-0 bg-card z-10" />
              {Array.from({ length: 24 }).map((_, hour) => {
                const isMajor = hour % 3 === 0;
                const isCurrentHour = hour === currentHour;
                const showHourLabel = isCurrentHour || isMajor;

                return (
                  <div
                    key={hour}
                    data-testid={
                      isCurrentHour ? "current-hour-header" : undefined
                    }
                    className={cn(
                      "text-center text-[10px] font-mono select-none relative flex flex-col items-center justify-center h-5",
                      isCurrentHour
                        ? "text-brand font-semibold"
                        : "text-muted-foreground/60",
                    )}
                    title={
                      isCurrentHour
                        ? `Current hour (${formatHeaderHour(hour)})`
                        : undefined
                    }
                    aria-label={
                      isCurrentHour
                        ? `Current hour: ${formatCellHour(hour)}`
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        "leading-none",
                        !showHourLabel && "text-[8px] opacity-25",
                      )}
                    >
                      {showHourLabel ? formatHeaderHour(hour) : "·"}
                    </span>
                    {isCurrentHour && (
                      <span className="absolute bottom-0 w-1 h-1 rounded-full bg-brand" />
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
                        data-day={dayIdx}
                        data-hour={hour}
                        tabIndex={
                          focusPos.day === dayIdx && focusPos.hour === hour
                            ? 0
                            : -1
                        }
                        onFocus={() => setFocusPos({ day: dayIdx, hour })}
                        onKeyDown={(e) => {
                          let nextDay = dayIdx;
                          let nextHour = hour;
                          switch (e.key) {
                            case "ArrowRight":
                              nextHour = Math.min(23, hour + 1);
                              break;
                            case "ArrowLeft":
                              nextHour = Math.max(0, hour - 1);
                              break;
                            case "ArrowDown":
                              nextDay = Math.min(6, dayIdx + 1);
                              break;
                            case "ArrowUp":
                              nextDay = Math.max(0, dayIdx - 1);
                              break;
                            case "Home":
                              nextHour = 0;
                              break;
                            case "End":
                              nextHour = 23;
                              break;
                            default:
                              return;
                          }
                          e.preventDefault();
                          focusCell(nextDay, nextHour);
                        }}
                        onClick={() =>
                          setSelectedCell({
                            day,
                            hour,
                            minutes,
                          })
                        }
                        className={cn(
                          "w-full h-4 sm:h-5 md:h-5.5 min-w-[16px] rounded-[3px] transition-transform motion-safe:hover:scale-110 hover:z-10 relative focus-visible:ring-1 focus-visible:ring-brand flex items-center justify-center",
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-[10px] font-mono text-muted-foreground/70 pt-0.5">
            <span className="sm:hidden whitespace-nowrap">
              ← Swipe runway for all 24h →
            </span>
            <span className="hidden sm:inline whitespace-nowrap">
              24-hour focus runway
            </span>
            <span className="whitespace-nowrap">Intensity: 0m → 60m+</span>
          </div>
        </>
      )}
    </Card>
  );
}
