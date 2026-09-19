"use client";

import { CheckCircle2, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconCell } from "@/components/ui/IconCell";
import { useHaptic } from "@/lib/hooks/useHaptic";
import type { HabitType } from "@/lib/types/habit";

interface HabitTypeToggleProps {
  value: HabitType;
  onChange: (value: HabitType) => void;
}

const OPTIONS: { value: HabitType; label: string }[] = [
  { value: "boolean", label: "Yes or No" },
  { value: "measurable", label: "Measurable" },
];

export function HabitTypeToggle({ value, onChange }: HabitTypeToggleProps) {
  const { trigger } = useHaptic();
  const Icon = value === "measurable" ? Gauge : CheckCircle2;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/40 transition-seijaku-fast mx-2">
      <IconCell className="items-center pt-0">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={2.25} />
      </IconCell>
      <div className="inline-flex h-8 p-0.5 rounded-lg bg-secondary/10 border border-border/40 shrink-0">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (option.value !== value) {
                trigger("toggle");
                onChange(option.value);
              }
            }}
            aria-pressed={value === option.value}
            className={cn(
              "rounded-md px-2.5 h-7 text-[13px] font-medium tracking-tight border border-transparent transition-seijaku-fast",
              value === option.value
                ? "bg-brand text-brand-foreground border-brand/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
