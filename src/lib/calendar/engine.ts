// Pure event-positioning/overlap layout; see docs/CALENDAR.md for the architecture.

import { startOfDay, endOfDay, max, min, addDays, isSameDay } from "date-fns";
import type { CalendarEvent, PositionedEvent, DayColumn } from "./types";

function minutesSinceStartOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function timeToPercent(date: Date): number {
  return (minutesSinceStartOfDay(date) / 1440) * 100;
}

function clampToDay(event: CalendarEvent, day: Date): CalendarEvent {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  return {
    ...event,
    start: max([event.start, dayStart]),
    end: min([event.end, dayEnd]),
  };
}

/**
 * Renders events as thin row strips that strictly fit within their time slot;
 * height compresses dynamically as more events overlap in the same hour.
 */
function layoutDayEvents(
  events: CalendarEvent[],
  day: Date,
): PositionedEvent[] {
  const dayEvents = events
    .filter((e) => isSameDay(e.start, day) || isSameDay(e.end, day))
    .map((e) => clampToDay(e, day))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (dayEvents.length === 0) return [];

  const MAX_ROW_HEIGHT_PERCENT = 1.94; // % of the 24h day — ~56px at TimeGrid's HOUR_HEIGHT=120
  const MIN_ROW_HEIGHT_PERCENT = 1.0; // ~29px at that same scale
  const SLOT_HEIGHT_PERCENT = 4.16; // 1 hour (60/1440 * 100)

  const positioned: PositionedEvent[] = [];

  const hourGroups: Record<number, CalendarEvent[]> = {};

  dayEvents.forEach((event) => {
    const hour = event.start.getHours();
    if (!hourGroups[hour]) hourGroups[hour] = [];
    hourGroups[hour].push(event);
  });

  Object.entries(hourGroups).forEach(([_hourStr, groupEvents]) => {
    const count = groupEvents.length;
    const height = Math.min(
      MAX_ROW_HEIGHT_PERCENT,
      Math.max(MIN_ROW_HEIGHT_PERCENT, SLOT_HEIGHT_PERCENT / count),
    );

    // No gap once rows are already this compressed — it would eat into row height.
    const margin = height < 1.4 ? 0 : 0.1;

    groupEvents.forEach((event, index) => {
      const startPercent = timeToPercent(event.start);
      const offset = index * (height + margin);

      positioned.push({
        ...event,
        top: startPercent + offset,
        height: height,
        left: 0,
        width: 100,
        column: index,
        columnSpan: 1,
      });
    });
  });

  return positioned;
}

export function getDayRange(start: Date, days: number): Date[] {
  return Array.from({ length: days }).map((_, i) => addDays(start, i));
}

/** Layout for the Week / 3-Day / 4-Day views, one column per day. */
export function layoutDayRange(
  events: CalendarEvent[],
  days: Date[],
): DayColumn[] {
  return days.map((day) => ({
    date: day,
    events: layoutDayEvents(events, day),
  }));
}
