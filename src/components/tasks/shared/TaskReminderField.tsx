"use client";

import { useState } from "react";
import { Bell, BellOff, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { CollapsibleReveal } from "@/components/ui/collapsible-reveal";

interface TaskReminderFieldProps {
  reminderDays: number;
  onReminderDaysChange: (value: number) => void;
  isMobile?: boolean;
}

// Bit i is Date.getDay() (Sunday = 0).
const DAY_CHIPS: { bit: number; label: string; ariaLabel: string }[] = [
  { bit: 0, label: "S", ariaLabel: "Sunday" },
  { bit: 1, label: "M", ariaLabel: "Monday" },
  { bit: 2, label: "T", ariaLabel: "Tuesday" },
  { bit: 3, label: "W", ariaLabel: "Wednesday" },
  { bit: 4, label: "T", ariaLabel: "Thursday" },
  { bit: 5, label: "F", ariaLabel: "Friday" },
  { bit: 6, label: "S", ariaLabel: "Saturday" },
];

export const REMINDER_ALL_DAYS = 127;
export const REMINDER_WEEKDAYS = 62; // Mon (1) - Fri (5)
export const REMINDER_WEEKENDS = 65; // Sun (0) + Sat (6)
export const REMINDER_MUTED = 0;

export function formatReminderDays(mask: number): string {
  if (mask === REMINDER_ALL_DAYS) return "Every day";
  if (mask === REMINDER_WEEKDAYS) return "Weekdays";
  if (mask === REMINDER_WEEKENDS) return "Weekends";
  if (mask === REMINDER_MUTED) return "Muted";
  return "Custom";
}

export function TaskReminderField({
  reminderDays,
  onReminderDaysChange,
  isMobile = false,
}: TaskReminderFieldProps) {
  const [open, setOpen] = useState(false);
  const { trigger } = useHaptic();

  const isCustomized = reminderDays !== REMINDER_ALL_DAYS;
  const isMuted = reminderDays === REMINDER_MUTED;

  const toggleDay = (bit: number) => {
    trigger("tick");
    const mask = 1 << bit;
    onReminderDaysChange(
      reminderDays & mask ? reminderDays & ~mask : reminderDays | mask,
    );
  };

  const BellIcon = isMuted ? BellOff : Bell;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "inline-flex items-center justify-center gap-1.5 text-xs sm:text-[13px] font-medium rounded-md border transition-colors shrink-0 h-7 sm:h-8 shadow-none",
          isMobile ? "px-2" : "px-2.5",
          isCustomized
            ? "bg-secondary/70 border-border/80 font-semibold text-foreground"
            : "bg-secondary/40 hover:bg-secondary/60 border-border/50 text-muted-foreground hover:text-foreground",
        )}
        onClick={() => {
          trigger("toggle");
          setOpen((prev) => !prev);
        }}
        aria-label={`Notification days: ${formatReminderDays(reminderDays)}`}
        title={`Notification days: ${formatReminderDays(reminderDays)}`}
      >
        <BellIcon
          className={cn(
            "h-3.5 w-3.5",
            isCustomized ? "text-foreground" : "text-muted-foreground",
          )}
          strokeWidth={2.25}
        />
        {!isMobile && (
          <>
            <span className="hidden sm:inline">
              Alerts: {formatReminderDays(reminderDays)}
            </span>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform hidden sm:inline-block",
                open && "rotate-180",
              )}
              strokeWidth={2.25}
            />
          </>
        )}
      </Button>

      <CollapsibleReveal open={open} className="basis-full w-full">
        <div className="space-y-2 pt-1.5 pb-2 my-1 pl-2.5 ml-2 border-l-2 border-brand/40 rounded-r-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Allowed Notification Days
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {DAY_CHIPS.map(({ bit, label, ariaLabel }) => {
              const active = (reminderDays & (1 << bit)) !== 0;
              return (
                <button
                  key={bit}
                  type="button"
                  onClick={() => toggleDay(bit)}
                  aria-pressed={active}
                  aria-label={ariaLabel}
                  className={cn(
                    "relative h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-xs font-semibold flex items-center justify-center border transition-seijaku-fast",
                    active
                      ? "bg-brand text-brand-foreground border-transparent"
                      : "text-muted-foreground bg-secondary/10 border-border/40 hover:text-foreground hover:bg-secondary/40",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground/70 leading-normal">
            Push notifications only alert on selected days. Tasks remain on
            schedule.
          </p>
        </div>
      </CollapsibleReveal>
    </>
  );
}
