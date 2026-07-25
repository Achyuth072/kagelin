"use client";

import { differenceInCalendarDays, startOfWeek } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCalendarStore } from "@/lib/calendar/store";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { getDayRange, layoutDayRange } from "@/lib/calendar/engine";
import { scrollTopForNow } from "@/lib/calendar/grid-constants";
import {
  clampWindowStart,
  computeWindowGeometry,
  decideSwipeGesture,
  edgeAt,
  EDGE_TOLERANCE_PX,
  GUTTER_PX,
  INITIAL_WIDTH_GUESS_PX,
  SWIPE_THRESHOLD_PX,
  WEEK_LENGTH,
} from "@/lib/calendar/week-window";
import type { CalendarEvent } from "@/lib/calendar/types";
import { TimeGutter } from "./TimeGutter";
import { DayColumn } from "./DayColumn";

interface MobileWeekGridProps {
  events: CalendarEvent[];
  onDateNumberClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

/**
 * 3-6 day window onto the 7-day week (see CONTEXT.md "Calendar views").
 * Doesn't use useSwipe — it fires mid-scroll and fights the scroller.
 */
export function MobileWeekGrid({
  events,
  onDateNumberClick,
  onEventClick,
}: MobileWeekGridProps) {
  const { currentDate, next, prev, todayNonce } = useCalendarStore();
  const { trigger } = useHaptic();

  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);
  const dates = useMemo(() => getDayRange(weekStart, WEEK_LENGTH), [weekStart]);
  const columns = useMemo(() => layoutDayRange(events, dates), [events, dates]);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState(() => ({
    gutterPx: GUTTER_PX,
    ...computeWindowGeometry(INITIAL_WIDTH_GUESS_PX, GUTTER_PX),
  }));
  const pendingEdge = useRef<"start" | "end" | null>(null);
  const touch = useRef<{ x: number; y: number; left: number } | null>(null);

  // Measured, not a %: a % would grow unbounded past a few columns.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const gutterPx = gutterRef.current?.clientWidth ?? GUTTER_PX;
      setLayout({
        gutterPx,
        ...computeWindowGeometry(entry.contentRect.width, gutterPx),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Duplicated in TimeGrid.tsx — a shared hook trips the compiler's mutation check.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollTopForNow(el.clientHeight);
  }, [todayNonce]);

  // Lands the window on the paged-to edge, or today's position otherwise.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const edge = pendingEdge.current;
    pendingEdge.current = null;
    const target =
      edge === "start"
        ? 0
        : edge === "end"
          ? WEEK_LENGTH
          : differenceInCalendarDays(currentDate, weekStart);
    el.scrollLeft =
      clampWindowStart(target, layout.visibleDays) * layout.colWidth;
  }, [
    currentDate,
    weekStart,
    todayNonce,
    layout.visibleDays,
    layout.colWidth,
    scrollRef,
  ]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const el = scrollRef.current;
    if (!t || !el) return;
    touch.current = { x: t.clientX, y: t.clientY, left: el.scrollLeft };
  };

  const onTouchCancel = () => {
    touch.current = null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    const t = e.changedTouches[0];
    const el = scrollRef.current;
    touch.current = null;
    if (!start || !t || !el) return;

    const max = el.scrollWidth - el.clientWidth;
    const startEdge = edgeAt(start.left, max, EDGE_TOLERANCE_PX);
    const decision = decideSwipeGesture({
      dx: start.x - t.clientX,
      dy: start.y - t.clientY,
      threshold: SWIPE_THRESHOLD_PX,
      wasAtStart: startEdge === "start",
      wasAtEnd: startEdge === "end",
    });

    if (decision === "next") {
      pendingEdge.current = "start";
      trigger("toggle");
      next();
    } else if (decision === "prev") {
      pendingEdge.current = "end";
      trigger("toggle");
      prev();
    }
  };

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        data-testid="mobile-week-grid"
        className="flex flex-1 min-h-0 overflow-auto bg-background custom-scrollbar touch-auto overscroll-contain snap-x snap-proximity"
        style={{ scrollPaddingLeft: `${layout.gutterPx}px` }}
      >
        <TimeGutter ref={gutterRef} />
        <div
          className="flex h-fit divide-x divide-border/40"
          style={{ width: `${WEEK_LENGTH * layout.colWidth}px` }}
        >
          {columns.map((column) => (
            <DayColumn
              key={column.date.toString()}
              column={column}
              className="shrink-0 snap-start"
              style={{ width: `${layout.colWidth}px` }}
              compactIndicator
              onDateNumberClick={onDateNumberClick}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
