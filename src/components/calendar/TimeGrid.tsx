"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { useCalendarStore } from "@/lib/calendar/store";
import { cn } from "@/lib/utils";
import { getDayRange, layoutDayRange } from "@/lib/calendar/engine";
import { scrollTopForNow } from "@/lib/calendar/grid-constants";
import type { CalendarEvent } from "@/lib/calendar/types";
import { TimeGutter } from "./TimeGutter";
import { DayColumn } from "./DayColumn";

interface TimeGridProps {
  startDate: Date;
  daysToShow: number; // 1 for Day, 3 for Mobile, 4 for Desktop, 7 for Week
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
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => next(),
    onSwipeRight: () => prev(),
  });

  const dates = getDayRange(startDate, daysToShow);
  const columns = useMemo(() => layoutDayRange(events, dates), [events, dates]);

  const gridTemplateColumns = `repeat(${daysToShow}, 1fr)`;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Centers the current-time indicator on mount and whenever "Today" is pressed.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollTopForNow(el.clientHeight);
  }, [todayNonce]);

  return (
    <div
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
        <TimeGutter />
        <div
          className="flex-1 grid divide-x divide-border/40 h-fit"
          style={{ gridTemplateColumns }}
        >
          {columns.map((column) => (
            <DayColumn
              key={column.date.toString()}
              column={column}
              className="min-w-0 md:min-w-[120px]"
              compactIndicator={daysToShow === 7}
              onDateNumberClick={onDateNumberClick}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
