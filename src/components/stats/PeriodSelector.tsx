"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { STATS_PERIOD_OPTIONS, type StatsPeriod } from "@/lib/types/stats";
import { cn } from "@/lib/utils";
import * as m from "motion/react-m";
import { SEIJAKU_SPRING_FAST } from "@/lib/motion";

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
  const [activePeriod, setActivePeriod] = useState(value);
  useEffect(() => {
    setActivePeriod(value);
  }, [value]);

  const reduced = usePrefersReducedMotion();
  const { trigger } = useHaptic();

  return (
    <Tabs
      value={activePeriod}
      onValueChange={(next) => {
        if (next) {
          const p = next as StatsPeriod;
          setActivePeriod(p);
          trigger("tick");
          onValueChange(p);
        }
      }}
      className={cn("w-fit", className)}
    >
      <TabsList className="gap-1">
        {STATS_PERIOD_OPTIONS.map((opt) => {
          const isActive = activePeriod === opt.value;
          return (
            <TabsTrigger
              key={opt.value}
              value={opt.value}
              className="relative min-w-[38px] px-2.5 tabular-nums data-[state=active]:bg-transparent data-[state=active]:border-transparent data-[state=active]:shadow-none"
            >
              {isActive && (
                <m.span
                  layoutId="stats-period-pill"
                  transition={SEIJAKU_SPRING_FAST}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-md bg-card border border-border shadow-xs"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {opt.label}
                {opt.value === "all" && isAllLoading && (
                  <Loader2
                    className={cn("h-3 w-3", !reduced && "animate-spin")}
                    aria-label="Loading all-time data"
                    strokeWidth={2.25}
                  />
                )}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
