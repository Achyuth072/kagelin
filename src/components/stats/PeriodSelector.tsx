"use client";

import { Loader2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { STATS_PERIOD_OPTIONS, type StatsPeriod } from "@/lib/types/stats";
import { cn } from "@/lib/utils";

interface PeriodSelectorProps {
  value: StatsPeriod;
  onValueChange: (period: StatsPeriod) => void;
  isAllLoading?: boolean;
  className?: string;
}

export function PeriodSelector({
  value,
  onValueChange,
  isAllLoading = false,
  className,
}: PeriodSelectorProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as StatsPeriod);
      }}
      className={cn(
        "w-fit gap-1 rounded-lg border border-border/40 bg-secondary/10 p-1 shadow-none",
        className,
      )}
    >
      {STATS_PERIOD_OPTIONS.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          className={cn(
            "h-8 min-w-0 gap-1.5 rounded-md border border-transparent px-2.5 text-[13px] font-medium tracking-tight tabular-nums transition-all",
            "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
            "data-[state=on]:border-brand/20 data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:shadow-none",
          )}
        >
          {opt.label}
          {opt.value === "all" && isAllLoading && (
            <Loader2
              className={cn("h-3 w-3", !reduced && "animate-spin")}
              aria-label="Loading all-time data"
            />
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
