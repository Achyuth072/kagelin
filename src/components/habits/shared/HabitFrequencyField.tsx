"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { IconCell } from "@/components/ui/IconCell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumberField } from "@/components/ui/number-field";
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

  const setCount = (next: number | null) => {
    if (next == null) return;
    const clamped = Math.max(MIN_COUNT, Math.min(MAX_COUNT, next));
    if (clamped !== count) {
      onCountChange(clamped);
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
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-md">
      <IconCell className="pt-[7px] items-center">
        <Repeat className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
      </IconCell>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Tabs
          value={mode}
          onValueChange={(val) => {
            if (val) {
              selectMode(val as FrequencyMode);
            }
          }}
          className="w-full"
        >
          <TabsList size="sm" className="grid grid-cols-4 w-full">
            {MODES.map((m) => (
              <TabsTrigger key={m} value={m}>
                {MODE_LABELS[m]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Daily is 1-in-1, but pre-D habits may still be N per day. */}
        {(mode !== "daily" || count > 1) && (
          <div className="flex items-center gap-2 flex-wrap text-[13px] text-muted-foreground">
            <NumberField
              value={count}
              min={MIN_COUNT}
              max={MAX_COUNT}
              onValueChange={setCount}
              aria-label="Habit frequency count"
              decrementAriaLabel="Fewer times"
              incrementAriaLabel="More times"
              showSteppers
              inputClassName="w-6 text-center"
            />
            <span className="shrink-0">
              {count === 1 ? "time" : "times"}
              {mode === "daily" && " per day"}
              {mode === "weekly" && " per week"}
              {mode === "monthly" && " per month"}
              {mode === "custom" && " every"}
            </span>
            {mode === "custom" && (
              <>
                <NumberField
                  value={days}
                  min={MIN_DAYS}
                  max={MAX_FREQUENCY_DAYS}
                  allowOutOfRange
                  onValueChange={(val, details) => {
                    if (details.reason === "input-blur") {
                      if (val != null) {
                        onFrequencyDaysChange(
                          Math.max(MIN_DAYS, Math.min(MAX_FREQUENCY_DAYS, val)),
                        );
                      }
                    } else if (val != null) {
                      if (val >= MIN_DAYS && val <= MAX_FREQUENCY_DAYS) {
                        onFrequencyDaysChange(val);
                      }
                    }
                  }}
                  showSteppers={false}
                  aria-label="Number of days"
                  inputClassName="w-16 text-center"
                />
                <span className="shrink-0">days</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
