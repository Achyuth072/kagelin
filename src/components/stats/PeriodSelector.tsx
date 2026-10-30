"use client";

import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHaptic } from "@/lib/hooks/useHaptic";
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
  const { trigger } = useHaptic();

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        if (next) {
          trigger("tick");
          onValueChange(next as StatsPeriod);
        }
      }}
      className={cn("w-fit", className)}
    >
      <TabsList className="gap-1">
        {STATS_PERIOD_OPTIONS.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            className="min-w-0 gap-1.5 px-2.5 tabular-nums data-[state=active]:text-brand"
          >
            {opt.label}
            {opt.value === "all" && isAllLoading && (
              <Loader2
                className={cn("h-3 w-3", !reduced && "animate-spin")}
                aria-label="Loading all-time data"
              />
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
