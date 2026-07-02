"use client";

import { Repeat, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { useHaptic } from "@/lib/hooks/useHaptic";

export type FrequencyPeriod = "day" | "week" | "month";

interface HabitFrequencyFieldProps {
  count: number;
  period: FrequencyPeriod;
  onCountChange: (value: number) => void;
  onPeriodChange: (value: FrequencyPeriod) => void;
}

const MIN_COUNT = 1;
const MAX_COUNT = 30;

const PERIOD_LABELS: Record<FrequencyPeriod, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

/**
 * "N times per [Day | Week]" control for a Habit's Frequency. Authored periods
 * are day/week; `month` is import-only (offered here only when an existing
 * Habit already carries it, so editing never silently drops it). See CONTEXT.md
 * "Frequency progress".
 */
export function HabitFrequencyField({
  count,
  period,
  onCountChange,
  onPeriodChange,
}: HabitFrequencyFieldProps) {
  const { trigger } = useHaptic();

  const setCount = (next: number) => {
    const clamped = Math.max(MIN_COUNT, Math.min(MAX_COUNT, next));
    if (clamped !== count) {
      trigger("tick");
      onCountChange(clamped);
    }
  };

  const setPeriod = (next: FrequencyPeriod) => {
    if (next !== period) {
      trigger("toggle");
      onPeriodChange(next);
    }
  };

  // `month` is never authored — only shown as a segment when the Habit already
  // has it (import), so a monthly Habit stays editable without losing its period.
  const periods: FrequencyPeriod[] =
    period === "month" ? ["day", "week", "month"] : ["day", "week"];

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md mx-2">
      <IconCell className="pt-0 items-center">
        <Repeat className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
      </IconCell>
      {/* Single compact row — sized to fit narrow mobile drawers without wrapping */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {/* Count stepper */}
        <div className="inline-flex items-center h-8 rounded-lg border border-border/40 bg-secondary/10 shrink-0">
          <button
            type="button"
            onClick={() => setCount(count - 1)}
            disabled={count <= MIN_COUNT}
            aria-label="Fewer times"
            className="h-8 w-8 flex items-center justify-center rounded-l-lg text-muted-foreground transition-seijaku-fast hover:text-foreground hover:bg-secondary/40 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Minus className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <span className="w-6 text-center text-[13px] font-medium tabular-nums text-foreground">
            {count}
          </span>
          <button
            type="button"
            onClick={() => setCount(count + 1)}
            disabled={count >= MAX_COUNT}
            aria-label="More times"
            className="h-8 w-8 flex items-center justify-center rounded-r-lg text-muted-foreground transition-seijaku-fast hover:text-foreground hover:bg-secondary/40 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <span className="text-[13px] text-muted-foreground shrink-0">
          {count === 1 ? "time per" : "times per"}
        </span>

        {/* Period segmented toggle — matches SheetTabToggle */}
        <div className="inline-flex h-8 p-0.5 rounded-lg bg-secondary/10 border border-border/40 shrink-0">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={cn(
                "rounded-md px-2.5 h-7 text-[13px] font-medium tracking-tight border border-transparent transition-seijaku-fast",
                period === p
                  ? "bg-brand text-brand-foreground border-brand/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
