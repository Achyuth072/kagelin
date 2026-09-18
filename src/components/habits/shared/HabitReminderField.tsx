"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { useHaptic } from "@/lib/hooks/useHaptic";

interface HabitReminderFieldProps {
  reminderTime: string | null | undefined;
  onReminderTimeChange: (value: string | null) => void;
  reminderDays: number;
  onReminderDaysChange: (value: number) => void;
}

const DEFAULT_TIME = "09:00";

// Bit i = Date.getDay() (Sunday is bit 0) to match JS weekday indexing.
const DAY_CHIPS: { bit: number; label: string; ariaLabel: string }[] = [
  { bit: 0, label: "S", ariaLabel: "Sunday" },
  { bit: 1, label: "M", ariaLabel: "Monday" },
  { bit: 2, label: "T", ariaLabel: "Tuesday" },
  { bit: 3, label: "W", ariaLabel: "Wednesday" },
  { bit: 4, label: "T", ariaLabel: "Thursday" },
  { bit: 5, label: "F", ariaLabel: "Friday" },
  { bit: 6, label: "S", ariaLabel: "Saturday" },
];

export function HabitReminderField({
  reminderTime,
  onReminderTimeChange,
  reminderDays,
  onReminderDaysChange,
}: HabitReminderFieldProps) {
  const { trigger } = useHaptic();
  const isOn = !!reminderTime;

  const toggleOn = () => {
    trigger("toggle");
    onReminderTimeChange(isOn ? null : DEFAULT_TIME);
  };

  const toggleDay = (bit: number) => {
    trigger("tick");
    const mask = 1 << bit;
    onReminderDaysChange(
      reminderDays & mask ? reminderDays & ~mask : reminderDays | mask,
    );
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-seijaku-fast mx-2">
      <IconCell className="items-center pt-0">
        <Bell className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
      </IconCell>
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={toggleOn}
          aria-pressed={isOn}
          className={cn(
            "h-8 px-2.5 rounded-lg text-[13px] font-medium tracking-tight border border-border/40 bg-secondary/10 transition-seijaku-fast shrink-0",
            isOn
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
          )}
        >
          {isOn ? "On" : "Off"}
        </button>

        {isOn && (
          <>
            <input
              type="time"
              aria-label="Reminder time"
              value={reminderTime ?? DEFAULT_TIME}
              onChange={(e) => onReminderTimeChange(e.target.value)}
              className="h-8 px-2 text-[13px] rounded-lg border border-border/40 bg-secondary/10 outline-none shrink-0"
            />

            <div className="flex items-center gap-1 shrink-0">
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
                      "h-6 w-6 rounded-full text-[11px] font-semibold flex items-center justify-center border border-transparent transition-seijaku-fast",
                      active
                        ? "bg-brand text-brand-foreground"
                        : "text-muted-foreground bg-secondary/10 border-border/40 hover:text-foreground hover:bg-secondary/40",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
