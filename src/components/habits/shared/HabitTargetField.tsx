"use client";

import { Target } from "lucide-react";
import { IconCell } from "@/components/ui/IconCell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

        <Tabs
          value={targetType}
          onValueChange={(val) => {
            if (val) {
              setTargetType(val as TargetType);
            }
          }}
          className="shrink-0"
        >
          <TabsList size="sm">
            {(["at_least", "at_most"] as TargetType[]).map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                aria-label={t === "at_least" ? "At least" : "At most"}
                className="w-7 px-0"
              >
                {DIRECTION_LABELS[t]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
