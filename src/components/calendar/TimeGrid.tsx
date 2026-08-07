"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { useWindowGeometry } from "@/lib/hooks/useWindowGeometry";
import { useCalendarStore } from "@/lib/calendar/store";
import { cn } from "@/lib/utils";
import { getDayRange, layoutDayRange } from "@/lib/calendar/engine";
import { scrollTopForNow } from "@/lib/calendar/grid-constants";
import type { CalendarEvent } from "@/lib/calendar/types";
import { TimeGutter } from "./TimeGutter";
import { DayColumn } from "./DayColumn";

interface TimeGridProps {
  startDate: Date;
  // 1 for Day, 4 for Desktop, 7 for Week; "auto" derives it from measured
  // width for the mobile rolling view (see CONTEXT.md "Rolling view").
  daysToShow: number | "auto";
  events: CalendarEvent[];
  onDateNumberClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
  "data-testid"?: string;
}

export function TimeGrid({
  startDate,
  daysToShow,
  events,
  onDateNumberClick,
  onEventClick,
  className,
  "data-testid": testId,
}: TimeGridProps) {
  const { next, prev, todayNonce } = useCalendarStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const isAuto = daysToShow === "auto";
  const { visibleDays } = useWindowGeometry(containerRef, gutterRef, {
    enabled: isAuto,
  });
  const numDays = isAuto ? visibleDays : daysToShow;
  const overrideDays = isAuto ? numDays : undefined;

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => next(overrideDays),
    onSwipeRight: () => prev(overrideDays),
  });

  const dates = getDayRange(startDate, numDays);
  const columns = useMemo(() => layoutDayRange(events, dates), [events, dates]);

  const gridTemplateColumns = `repeat(${numDays}, 1fr)`;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Duplicated in MobileWeekGrid.tsx — a shared hook trips the compiler's mutation check.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollTopForNow(el.clientHeight);
  }, [todayNonce]);

  return (
    <div
      ref={containerRef}
      {...swipeHandlers}
      data-testid={testId || "time-grid"}
      className={cn("h-full flex flex-col", className)}
    >
      <div
        ref={scrollRef}
        className={cn(
          "flex flex-1 min-h-0 overflow-auto bg-background custom-scrollbar",
          "touch-pan-y overscroll-contain",
        )}
      >
        <TimeGutter ref={gutterRef} />
        <div
          className="flex-1 grid divide-x divide-border/40 h-fit"
          style={{ gridTemplateColumns }}
        >
          {columns.map((column) => (
            <DayColumn
              key={column.date.toString()}
              column={column}
              className="min-w-0 md:min-w-[120px]"
              onDateNumberClick={onDateNumberClick}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
