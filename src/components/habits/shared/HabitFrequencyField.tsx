"use client";

import { useState } from "react";
import { Repeat, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { MAX_FREQUENCY_DAYS, type FrequencyPeriod } from "@/lib/types/habit";
import {
  frequencyWindowDays,
  periodForFrequencyDays,
} from "@/lib/utils/habit-frequency";

type FrequencyMode = "daily" | "weekly" | "monthly" | "custom";

const MIN_COUNT = 1;
const MAX_COUNT = 30;
const MIN_DAYS = 2;
const DEFAULT_CUSTOM_DAYS = 3;

const MODE_LABELS: Record<FrequencyMode, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

const MODES = Object.keys(MODE_LABELS) as FrequencyMode[];

const MODE_FOR_PERIOD: Record<FrequencyPeriod, FrequencyMode> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
};

function deriveMode(days: number): FrequencyMode {
  const period = periodForFrequencyDays(days);
  return period ? MODE_FOR_PERIOD[period] : "custom";
}

interface HabitFrequencyFieldProps {
  count: number;
  period: FrequencyPeriod | null | undefined;
  frequencyDays: number | undefined;
  onCountChange: (value: number) => void;
  onPeriodChange: (value: FrequencyPeriod | null) => void;
  onFrequencyDaysChange: (value: number | undefined) => void;
}

export function HabitFrequencyField({
  count,
  period,
  frequencyDays,
  onCountChange,
  onPeriodChange,
  onFrequencyDaysChange,
}: HabitFrequencyFieldProps) {
  const { trigger } = useHaptic();
  // Keeps the Custom row open while the user types a D that equals 7 or 30.
  const [customPicked, setCustomPicked] = useState(false);
  const days = frequencyWindowDays({
    frequency_days: frequencyDays,
    frequency_period: period,
  });
  const mode = customPicked ? "custom" : deriveMode(days);

  const setCount = (next: number) => {
    const clamped = Math.max(MIN_COUNT, Math.min(MAX_COUNT, next));
    if (clamped !== count) {
      trigger("tick");
      onCountChange(clamped);
    }
  };

  const setD = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      onFrequencyDaysChange(
        Math.max(MIN_DAYS, Math.min(MAX_FREQUENCY_DAYS, n)),
      );
    }
  };

  const selectMode = (next: FrequencyMode) => {
    if (next === mode) return;
    trigger("toggle");
    setCustomPicked(next === "custom");
    switch (next) {
      case "daily":
        onCountChange(1);
        onPeriodChange("day");
        onFrequencyDaysChange(undefined);
        break;
      case "weekly":
        onPeriodChange("week");
        onFrequencyDaysChange(undefined);
        break;
      case "monthly":
        onPeriodChange("month");
        onFrequencyDaysChange(undefined);
        break;
      case "custom":
        onPeriodChange(null);
        onFrequencyDaysChange(days > 1 ? days : DEFAULT_CUSTOM_DAYS);
        break;
    }
  };

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-md mx-2">
      <IconCell className="pt-[7px] items-center">
        <Repeat className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
      </IconCell>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex h-8 p-0.5 rounded-lg bg-secondary/10 border border-border/40 gap-0.5">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => selectMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "flex-1 rounded-md px-2 h-7 text-[13px] font-medium tracking-tight border border-transparent transition-seijaku-fast",
                mode === m
                  ? "bg-brand text-brand-foreground border-brand/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
              )}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {mode !== "daily" && (
          <div className="flex items-center gap-2 flex-wrap text-[13px] text-muted-foreground">
            <CountStepper
              value={count}
              min={MIN_COUNT}
              max={MAX_COUNT}
              onChange={setCount}
            />
            <span className="shrink-0">
              {count === 1 ? "time" : "times"}
              {mode === "weekly" && " per week"}
              {mode === "monthly" && " per month"}
              {mode === "custom" && " every"}
            </span>
            {mode === "custom" && (
              <>
                <DayInput value={days} onChange={setD} />
                <span className="shrink-0">days</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CountStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center h-8 rounded-lg border border-border/40 bg-secondary/10 shrink-0">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Fewer times"
        className="h-8 w-8 flex items-center justify-center rounded-l-lg text-muted-foreground transition-seijaku-fast hover:text-foreground hover:bg-secondary/40 disabled:opacity-40 disabled:pointer-events-none"
      >
        <Minus className="h-4 w-4" strokeWidth={2.25} />
      </button>
      <span className="w-6 text-center text-[13px] font-medium tabular-nums text-foreground">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="More times"
        className="h-8 w-8 flex items-center justify-center rounded-r-lg text-muted-foreground transition-seijaku-fast hover:text-foreground hover:bg-secondary/40 disabled:opacity-40 disabled:pointer-events-none"
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}

function DayInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (raw: string) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={MIN_DAYS}
      max={MAX_FREQUENCY_DAYS}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Number of days"
      className="h-8 w-16 rounded-lg border border-border/40 bg-secondary/10 text-center text-[13px] font-medium tabular-nums text-foreground outline-none focus:ring-1 focus:ring-brand/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}
