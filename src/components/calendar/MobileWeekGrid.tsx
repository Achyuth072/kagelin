"use client";

import { addDays, differenceInCalendarDays, startOfWeek } from "date-fns";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCalendarStore } from "@/lib/calendar/store";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useScrollSettle } from "@/lib/hooks/useScrollSettle";
import { useWindowGeometry } from "@/lib/hooks/useWindowGeometry";
import { getDayRange, layoutDayRange } from "@/lib/calendar/engine";
import { scrollTopForNow } from "@/lib/calendar/grid-constants";
import {
  alignTarget,
  clampWindowStart,
  decideSwipeGesture,
  edgeAt,
  EDGE_TOLERANCE_PX,
  SWIPE_THRESHOLD_PX,
  WEEK_LENGTH,
  type PageDirection,
} from "@/lib/calendar/week-window";
import type { CalendarEvent } from "@/lib/calendar/types";
import { TimeGutter } from "./TimeGutter";
import { DayColumn } from "./DayColumn";

interface MobileWeekGridProps {
  events: CalendarEvent[];
  onDateNumberClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const PAGE_EDGE: Record<PageDirection, "start" | "end"> = {
  next: "start",
  prev: "end",
};

const SCROLL_SETTLE_MS = 120;
const BRIDGE_TIMEOUT_MS = 600;

type Bridge = {
  direction: PageDirection;
  columns: ReturnType<typeof layoutDayRange>;
  targetScrollLeft: number;
};

/**
 * 3-6 day window onto the 7-day week.
 * Doesn't use useSwipe, it fires mid-scroll and fights the scroller.
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

  const layout = useWindowGeometry(containerRef, gutterRef);
  const pendingEdge = useRef<"start" | "end" | null>(null);
  const touch = useRef<{ x: number; y: number; left: number } | null>(null);
  const [bridge, setBridge] = useState<Bridge | null>(null);

  // Duplicated in TimeGrid.tsx — a shared hook trips the compiler's mutation check.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollTopForNow(el.clientHeight);
  }, [todayNonce]);

  // Layout effect so the bridge's strip collapsing back to 7 days never flashes.
  useLayoutEffect(() => {
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

  // Commits the paged week; the effect above lands the scroll position.
  const finishBridge = (direction: PageDirection) => {
    pendingEdge.current = PAGE_EDGE[direction];
    setBridge(null);
    if (direction === "next") next();
    else prev();
  };

  // Paging backward prepends a week, so scrollLeft must jump by its width first.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !bridge) return;
    if (bridge.direction === "prev")
      el.scrollLeft += WEEK_LENGTH * layout.colWidth;
    el.scrollTo({ left: bridge.targetScrollLeft, behavior: "smooth" });
  }, [bridge, layout.colWidth]);

  useScrollSettle(
    scrollRef,
    bridge !== null,
    () => bridge && finishBridge(bridge.direction),
    { settleMs: SCROLL_SETTLE_MS, timeoutMs: BRIDGE_TIMEOUT_MS },
  );

  // No scroll-snap CSS: WebKit drops it on the programmatic scrollLeft the
  // effects above rely on, so this corrects a mid-column rest after the
  // fact. Gated outside a bridge — that has its own settle listener above.
  useScrollSettle(
    scrollRef,
    bridge === null,
    () => {
      const el = scrollRef.current;
      if (!el) return;
      const target = alignTarget(el.scrollLeft, layout.colWidth);
      if (target !== null) el.scrollTo({ left: target, behavior: "smooth" });
    },
    { settleMs: SCROLL_SETTLE_MS, repeat: true },
  );

  const startBridge = (direction: PageDirection) => {
    const isPrev = direction === "prev";
    const newWeekStart = addDays(
      weekStart,
      isPrev ? -WEEK_LENGTH : WEEK_LENGTH,
    );
    const newColumns = layoutDayRange(
      events,
      getDayRange(newWeekStart, WEEK_LENGTH),
    );
    const targetIndex = isPrev
      ? clampWindowStart(WEEK_LENGTH, layout.visibleDays)
      : WEEK_LENGTH;
    const [before, after] = isPrev
      ? [newColumns, columns]
      : [columns, newColumns];
    setBridge({
      direction,
      columns: [...before, ...after],
      targetScrollLeft: targetIndex * layout.colWidth,
    });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (bridge) return;
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
    if (bridge || !start || !t || !el) return;

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
      trigger("toggle");
      startBridge("next");
    } else if (decision === "prev") {
      trigger("toggle");
      startBridge("prev");
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
        className="flex flex-1 min-h-0 overflow-auto bg-background custom-scrollbar no-horizontal-scrollbar touch-auto overscroll-contain"
      >
        <TimeGutter ref={gutterRef} />
        <div
          className="flex h-fit divide-x divide-border/40"
          style={{
            width: `${(bridge?.columns.length ?? WEEK_LENGTH) * layout.colWidth}px`,
          }}
        >
          {(bridge?.columns ?? columns).map((column) => (
            <DayColumn
              key={column.date.toString()}
              column={column}
              className="shrink-0"
              style={{ width: `${layout.colWidth}px` }}
              onDateNumberClick={onDateNumberClick}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
