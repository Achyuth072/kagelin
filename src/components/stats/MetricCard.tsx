"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  /**
   * "compact" tightens padding and value scale for dense contexts like the
   * task/habit insights panels inside the sheet; "default" keeps the larger
   * stats-page scale.
   */
  size?: "default" | "compact";
  className?: string;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  size = "default",
  className,
}: MetricCardProps) {
  const compact = size === "compact";

  return (
    <Card
      className={cn(
        "h-full border-border",
        compact ? "p-4" : "p-4 md:p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "min-w-0",
            compact ? "space-y-1.5" : "space-y-1.5 md:space-y-2",
          )}
        >
          <p className="type-ui uppercase text-[10px] md:text-xs text-muted-foreground font-medium tracking-wider wrap-break-word">
            {title}
          </p>
          <p
            className={cn(
              "font-semibold tracking-[-0.02em]",
              compact ? "text-2xl" : "text-2xl md:text-4xl",
            )}
          >
            {value}
          </p>
          {trend && (
            <div
              role="img"
              aria-label={`${trend.isPositive ? "Increased" : "Decreased"} by ${Math.abs(trend.value)}% compared to last period`}
              className={cn(
                "text-[11px] md:text-xs font-bold flex items-center gap-1 w-fit px-2 py-0.5 rounded-md mt-1.5 border transition-all",
                trend.value === 0
                  ? "text-muted-foreground bg-secondary/50 border-border/50"
                  : trend.isPositive
                    ? "text-brand bg-brand/15 border-brand/20"
                    : "text-destructive bg-destructive/15 border-destructive/20",
              )}
            >
              <span className="text-xs md:text-sm" aria-hidden="true">
                {trend.isPositive ? "↑" : "↓"}
              </span>
              <span className="tracking-tight">{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "rounded-lg bg-secondary shrink-0",
              compact ? "p-1.5" : "p-1.5 md:p-2",
            )}
          >
            <Icon
              className={cn(
                "text-foreground/70",
                compact ? "h-4 w-4" : "h-4 w-4 md:h-5 md:w-5",
              )}
              strokeWidth={2.25}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
