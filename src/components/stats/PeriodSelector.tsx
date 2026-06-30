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
      className={cn("w-fit", className)}
    >
      {STATS_PERIOD_OPTIONS.map((opt) => (
        <ToggleGroupItem key={opt.value} value={opt.value} className="gap-1.5">
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
