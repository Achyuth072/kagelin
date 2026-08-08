"use client";

import { format, isSameDay } from "date-fns";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import { cn } from "@/lib/utils";
import {
  HOUR_HEIGHT,
  HEADER_HEIGHT,
  hours,
} from "@/lib/calendar/grid-constants";
import type {
  CalendarEvent,
  DayColumn as DayColumnData,
} from "@/lib/calendar/types";
import { CurrentTimeIndicator } from "./CurrentTimeIndicator";

interface DayColumnProps {
  column: DayColumnData;
  className?: string;
  style?: React.CSSProperties;
  onDateNumberClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export function DayColumn({
  column,
  className,
  style,
  onDateNumberClick,
  onEventClick,
}: DayColumnProps) {
  const { formatTime } = useTimeFormat();
  const isToday = isSameDay(column.date, new Date());

  return (
    <div
      data-testid="day-column"
      data-date={column.date.toISOString().slice(0, 10)}
      data-today={isToday}
      className={cn("relative", isToday && "bg-brand/[0.09]", className)}
      style={style}
    >
      <div
        className="sticky top-0 z-40 bg-background border-b border-border/40 flex flex-col items-center justify-center gap-1"
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <div
          className={cn(
            "text-[10px] md:text-xs uppercase tracking-wider",
            isToday
              ? "text-brand font-bold"
              : "text-muted-foreground/70 font-medium",
          )}
        >
          {format(column.date, "EEE")}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDateNumberClick?.(column.date);
          }}
          className={cn(
            "text-lg md:text-xl font-bold inline-flex items-center justify-center transition-all",
            "hover:bg-brand/10 rounded-lg w-9 h-9 md:w-11 md:h-11",
            isToday && "bg-brand text-white shadow-sm hover:bg-brand/90",
          )}
        >
          {format(column.date, "d")}
        </button>
      </div>

      {hours.map((hour) => (
        <div
          key={hour}
          className="border-t border-border/40"
          style={{ height: `${HOUR_HEIGHT}px` }}
        />
      ))}

      {isToday && <CurrentTimeIndicator />}

      {column.events.map((event) => {
        const topPx = (event.top / 100) * (24 * HOUR_HEIGHT);
        const heightPx = (event.height / 100) * (24 * HOUR_HEIGHT);
        const isTask = event.category === "task";

        return (
          <div
            key={event.id}
            className={cn(
              "absolute rounded-sm px-1 md:px-2 py-1 text-[10px] md:text-xs cursor-pointer overflow-hidden flex flex-col gap-0.5",
              "z-10 hover:z-20 hover:brightness-95 active:scale-[0.98] transition-all",
              isTask
                ? "bg-brand/8 border-t border-t-border/40 border-r border-r-border/40 border-b border-b-border/40 text-foreground"
                : "bg-brand/90 text-white border-l-2 border-brand",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick?.(event);
            }}
            style={{
              top: `${topPx + HEADER_HEIGHT}px`,
              height: `${Math.max(heightPx, 24)}px`,
              left: "1px",
              right: "1px",
              width: "calc(100% - 2px)",
              ...(isTask && {
                borderLeftColor: event.color || "#4B6CB7",
                borderLeftWidth: "4px",
              }),
            }}
          >
            <div className="font-bold truncate text-[10px] md:text-[11px] leading-tight">
              {event.title}
            </div>
            {heightPx > 40 && (
              <div
                className={cn(
                  "text-[9px] md:text-[10px] leading-tight font-medium",
                  isTask ? "text-muted-foreground/70" : "text-white/80",
                )}
              >
                {formatTime(event.start)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
