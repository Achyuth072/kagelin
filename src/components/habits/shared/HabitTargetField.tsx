"use client";

import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { useHaptic } from "@/lib/hooks/useHaptic";

export type TargetType = "at_least" | "at_most";

interface HabitTargetFieldProps {
  targetValue: number | undefined;
  unit: string;
  targetType: TargetType;
  onTargetValueChange: (value: number | undefined) => void;
  onUnitChange: (value: string) => void;
  onTargetTypeChange: (value: TargetType) => void;
}

const DIRECTION_LABELS: Record<TargetType, string> = {
  at_least: "≥",
  at_most: "≤",
};

export function HabitTargetField({
  targetValue,
  unit,
  targetType,
  onTargetValueChange,
  onUnitChange,
  onTargetTypeChange,
}: HabitTargetFieldProps) {
  const { trigger } = useHaptic();

  const setTargetType = (next: TargetType) => {
    if (next !== targetType) {
      trigger("toggle");
      onTargetTypeChange(next);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-seijaku-fast mx-2">
      <IconCell className="items-center pt-0">
        <Target className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
      </IconCell>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          placeholder="0"
          aria-label="Target value"
          value={targetValue ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onTargetValueChange(raw === "" ? undefined : Number(raw));
          }}
          className="h-8 w-16 text-center text-[13px] font-medium rounded-lg border border-border/40 bg-secondary/10 p-0 outline-none placeholder:text-muted-foreground/60"
        />

        <input
          type="text"
          placeholder="unit"
          aria-label="Target unit"
          value={unit}
          onChange={(e) => onUnitChange(e.target.value)}
          className="h-8 px-2.5 text-[13px] rounded-lg border border-border/40 bg-secondary/10 w-24 outline-none placeholder:text-muted-foreground/60"
        />

        <div className="inline-flex h-8 p-0.5 rounded-lg bg-secondary/10 border border-border/40 shrink-0">
          {(["at_least", "at_most"] as TargetType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTargetType(t)}
              aria-pressed={targetType === t}
              aria-label={t === "at_least" ? "At least" : "At most"}
              className={cn(
                "rounded-md w-7 h-7 text-[13px] font-medium tracking-tight border border-transparent transition-seijaku-fast",
                targetType === t
                  ? "bg-brand text-brand-foreground border-brand/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
              )}
            >
              {DIRECTION_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
