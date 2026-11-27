"use client";

import { useState, useEffect, useRef } from "react";
import { format, addDays } from "date-fns";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import { useScrollIsolation } from "@/lib/hooks/useScrollIsolation";
import { Calendar } from "@/components/ui/calendar";
import { SegmentedTimePicker } from "@/components/ui/segmented-time-picker";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateTimeWizardProps {
  title?: string;
  description?: string;
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  onClose: () => void;
  showTime?: boolean;
  allowPastDates?: boolean;
  compact?: boolean;
  onEveningSelect?: () => void;
  allowClear?: boolean;
}

export function DateTimeWizard({
  title,
  description,
  date,
  setDate,
  onClose,
  showTime = true,
  allowPastDates = false,
  compact = false,
  onEveningSelect,
  allowClear = false,
}: DateTimeWizardProps) {
  const { trigger } = useHaptic();
  const { formatTime } = useTimeFormat();
  const [step, setStep] = useState<"date" | "time">("date");
  const [tempDate, setTempDate] = useState<Date | undefined>(date);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempDate(date);
  }, [date]);

  useScrollIsolation(scrollRef);

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setTempDate(undefined);
      return;
    }

    const updatedDate = new Date(newDate);
    if (tempDate) {
      updatedDate.setHours(tempDate.getHours(), tempDate.getMinutes());
    } else {
      // Default to 12:00 PM (noon) instead of start-of-day 00:00 or 9 AM to avoid edge cases around date boundary
      updatedDate.setHours(12, 0, 0, 0);
    }

    setTempDate(updatedDate);
  };

  const handleTimeChange = (newTime: Date) => {
    setTempDate(newTime);
  };

  const onSave = () => {
    trigger("thud");
    setDate(tempDate);
    onClose();
  };

  const handleClear = () => {
    trigger("toggle");
    setDate(undefined);
    onClose();
  };

  const showClear =
    allowClear && (tempDate !== undefined || date !== undefined);

  return (
    <div className="flex flex-col w-full max-w-[320px] mx-auto bg-popover rounded-md overflow-hidden">
      <div className="flex flex-col px-2.5 pt-2.5 pb-1.5 border-b border-border gap-1">
        {title && (
          <div className="px-1 text-xs font-semibold text-foreground tracking-wide">
            {title}
          </div>
        )}
        {description && (
          <div className="px-1 text-[11px] text-muted-foreground leading-snug">
            {description}
          </div>
        )}
        <Tabs
          value={step}
          onValueChange={(v) => {
            const nextStep = v as "date" | "time";
            trigger("toggle");
            if (nextStep === "time" && !tempDate) {
              const todayNoon = new Date();
              todayNoon.setHours(12, 0, 0, 0);
              setTempDate(todayNoon);
            }
            setStep(nextStep);
          }}
          className="w-full"
        >
          <TabsList
            className={cn(
              "grid w-full h-9 p-0.5 bg-muted",
              showTime ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <TabsTrigger
              value="date"
              className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-sm"
            >
              <CalendarIcon aria-hidden="true" strokeWidth={2.25} />
              {tempDate ? format(tempDate, "MMM d") : "Date"}
            </TabsTrigger>
            {showTime && (
              <TabsTrigger
                value="time"
                className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-sm"
              >
                <Clock aria-hidden="true" strokeWidth={2.25} />
                {tempDate ? formatTime(tempDate) : "Time"}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      <div
        ref={scrollRef}
        className="p-2 sm:p-2.5 overflow-y-auto overscroll-contain"
        style={
          compact
            ? {
                maxHeight:
                  "calc(min(380px, var(--radix-popover-content-available-height, 80dvh)) - 52px)",
              }
            : undefined
        }
      >
        {step === "date" ? (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-card border border-border rounded-lg p-1.5 flex justify-center">
              <Calendar
                mode="single"
                selected={tempDate}
                onSelect={handleDateSelect}
                disabled={
                  allowPastDates
                    ? undefined
                    : { before: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
                captionLayout="label"
                startMonth={new Date(new Date().getFullYear() - 1, 0)}
                endMonth={new Date(new Date().getFullYear() + 5, 11)}
                autoFocus
                className="w-full flex justify-center p-0"
                classNames={{
                  month: "space-y-2 w-full",
                  month_grid: "w-full border-collapse",
                  weekdays: "flex w-full justify-between",
                  week: "flex w-full justify-between mt-1",
                  day: "p-0 font-normal",
                  weekday:
                    "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {[
                {
                  label: "Today",
                  hint: format(new Date(), "EEE"),
                  onClick: () => {
                    const today = new Date();
                    today.setHours(12, 0, 0, 0);
                    handleDateSelect(today);
                  },
                },
                {
                  label: "Tomorrow",
                  hint: format(addDays(new Date(), 1), "EEE"),
                  onClick: () => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(12, 0, 0, 0);
                    handleDateSelect(tomorrow);
                  },
                },
                {
                  label: "Next Week",
                  hint: format(addDays(new Date(), 7), "EEE"),
                  onClick: () => {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    nextWeek.setHours(12, 0, 0, 0);
                    handleDateSelect(nextWeek);
                  },
                },
                {
                  label: "Evening",
                  hint: "6pm",
                  onClick: () => {
                    const evening = new Date();
                    evening.setHours(18, 0, 0, 0);
                    setTempDate(evening);
                    onEveningSelect?.();
                  },
                },
              ].map(({ label, hint, onClick }) => (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={label}
                  className="h-9 sm:h-8 px-2.5 text-xs bg-card hover:bg-accent border border-border font-medium flex items-center justify-between text-foreground rounded-md"
                  onClick={() => {
                    trigger("tick");
                    onClick();
                  }}
                >
                  <span>{label}</span>
                  <span
                    aria-hidden="true"
                    className="font-mono tabular-nums text-[11px] text-muted-foreground"
                  >
                    {hint}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in slide-in-from-right-5 fade-in duration-200">
            <SegmentedTimePicker
              value={tempDate || new Date()}
              onChange={handleTimeChange}
              onConfirm={onSave}
            />

            <div className="grid grid-cols-2 gap-1.5 mt-3 w-full">
              {[
                { label: "Morning", hour: 9 },
                { label: "Afternoon", hour: 13 },
                { label: "Evening", hour: 18 },
                { label: "Night", hour: 21 },
              ].map(({ label, hour }) => (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 sm:h-8 px-2.5 text-xs bg-card hover:bg-accent border border-border rounded-md flex items-center justify-between font-medium text-foreground"
                  onClick={() => {
                    trigger("tick");
                    const d = new Date(tempDate || new Date());
                    d.setHours(hour, 0, 0, 0);
                    setTempDate(d);
                  }}
                >
                  <span>{label}</span>
                  <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
                    {hour < 12
                      ? `${hour}am`
                      : hour === 12
                        ? "12pm"
                        : `${hour - 12}pm`}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-border">
        {showClear ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-accent gap-1.5"
            onClick={handleClear}
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.25} />
            Clear
          </Button>
        ) : (
          <div />
        )}
        <Button
          size="sm"
          className="h-10 px-5 sm:h-8 sm:px-4 w-auto gap-1.5"
          onClick={onSave}
        >
          <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
          Done
        </Button>
      </div>
    </div>
  );
}
