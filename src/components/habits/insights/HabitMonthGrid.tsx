"use client";

import { useState } from "react";
import {
  addMonths,
  differenceInCalendarMonths,
  format,
  getISODay,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHabitCellActions } from "@/lib/hooks/useHabitCellActions";
import { useCoarsePointer } from "@/lib/hooks/useCoarsePointer";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { getMonthDays } from "@/lib/utils/habit-rolling";
import type { HabitWithEntries } from "@/lib/types/habit";
import { HabitStripCell } from "../HabitStripCell";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

interface HabitMonthGridProps {
  habit: HabitWithEntries;
}

export function HabitMonthGrid({ habit }: HabitMonthGridProps) {
  const { onToggle, onLogValue, onClearValue } = useHabitCellActions(habit);
  const coarse = useCoarsePointer();
  const { trigger } = useHaptic();

  const today = new Date();
  const currentMonth = startOfMonth(today);
  const [displayedMonth, setDisplayedMonth] = useState<Date>(currentMonth);

  const earliestEntry = habit.entries.reduce<string | null>(
    (min, e) => (min === null || e.date < min ? e.date : min),
    null,
  );
  const habitOrigin =
    habit.start_date?.slice(0, 10) ?? habit.created_at?.slice(0, 10);
  const earliest = [habitOrigin, earliestEntry]
    .filter((d): d is string => Boolean(d))
    .reduce<string | null>(
      (min, d) => (min === null || d < min ? d : min),
      null,
    );
  const earliestMonth = earliest
    ? startOfMonth(parseISO(earliest))
    : currentMonth;

  const canGoPrev =
    differenceInCalendarMonths(displayedMonth, earliestMonth) > 0;
  const canGoNext =
    differenceInCalendarMonths(currentMonth, displayedMonth) > 0;
  const isCurrentMonth = !canGoNext;

  const handlePrev = () => {
    if (!canGoPrev) return;
    trigger("tick");
    setDisplayedMonth((m) => startOfMonth(subMonths(m, 1)));
  };

  const handleNext = () => {
    if (!canGoNext) return;
    trigger("tick");
    setDisplayedMonth((m) => startOfMonth(addMonths(m, 1)));
  };

  const handleToday = () => {
    if (isCurrentMonth) return;
    trigger("tick");
    setDisplayedMonth(currentMonth);
  };

  const swipeHandlers = useSwipe({
    onSwipeRight: handlePrev,
    onSwipeLeft: handleNext,
  });

  const label = format(displayedMonth, "MMMM yyyy");
  const days = getMonthDays(
    habit.entries,
    displayedMonth,
    today,
    habit.start_date,
  );
  const leadingBlanks = getISODay(displayedMonth) - 1;

  return (
    <div {...swipeHandlers} className="w-full space-y-2.5 touch-pan-y">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
          {label}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            disabled={!canGoPrev}
            onClick={handlePrev}
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isCurrentMonth}
            onClick={handleToday}
            className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            disabled={!canGoNext}
            onClick={handleNext}
            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div role="group" aria-label={label} className="w-full">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 lg:gap-2 w-full">
          {WEEKDAYS.map((d, i) => (
            <span
              key={i}
              aria-hidden
              className="text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground/60 h-4 flex items-center justify-center w-full max-w-[44px] mx-auto"
            >
              {d}
            </span>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div
              key={`blank-${i}`}
              aria-hidden
              className="w-full max-w-[44px] mx-auto"
            />
          ))}
          {days.map((day) => (
            <div key={day.date} className="w-full max-w-[44px] mx-auto">
              <HabitStripCell
                day={day}
                header={day.date.slice(8).replace(/^0/, "")}
                color={habit.color}
                coarse={coarse}
                onToggle={onToggle}
                habit={habit}
                onLogValue={onLogValue}
                onClearValue={onClearValue}
                size="sm"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
