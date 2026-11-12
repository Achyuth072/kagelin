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
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs sm:text-sm font-semibold text-foreground">
          {label}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Today"
            disabled={isCurrentMonth}
            onClick={handleToday}
            className={cn(
              "h-7 sm:h-8 text-xs font-medium rounded-lg border border-border/50 bg-secondary/40 shadow-none transition-seijaku-fast focus-visible:ring-2 focus-visible:ring-brand",
              "w-7 sm:w-auto px-0 sm:px-2.5",
              isCurrentMonth
                ? "text-muted-foreground/50 disabled:opacity-40"
                : "text-foreground hover:bg-secondary/60",
            )}
          >
            <CalendarIcon
              className="h-3.5 w-3.5 sm:mr-1.5"
              strokeWidth={2.25}
            />
            <span className="hidden sm:inline">Today</span>
          </Button>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              disabled={!canGoPrev}
              onClick={handlePrev}
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-brand hover:bg-brand/10 transition-seijaku-fast focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              disabled={!canGoNext}
              onClick={handleNext}
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-brand hover:bg-brand/10 transition-seijaku-fast focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </div>
        </div>
      </div>

      <div role="group" aria-label={label} className="w-full">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 w-full">
          {WEEKDAYS.map((d, i) => (
            <span
              key={i}
              aria-hidden
              className="text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground/60 h-4 flex items-center justify-center w-full max-w-8 mx-auto"
            >
              {d}
            </span>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div
              key={`blank-${i}`}
              aria-hidden
              className="w-full max-w-8 mx-auto"
            />
          ))}
          {days.map((day) => (
            <div key={day.date} className="w-full max-w-8 mx-auto">
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
