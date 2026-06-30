"use client";

import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

export interface StatsBarListItem {
  key: string;
  label: string;
  displayValue: string;
  color: string;
  /** 0-1 width fraction of the bar track. */
  ratio: number;
}

interface StatsBarListProps {
  items: StatsBarListItem[];
  className?: string;
}

export function StatsBarList({ items, className }: StatsBarListProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-3">
          <div
            className="w-20 shrink-0 text-sm text-muted-foreground truncate"
            title={item.label}
          >
            {item.label}
          </div>
          <div className="flex-1 h-6 rounded-md bg-secondary/50 overflow-hidden">
            <div
              className="h-full rounded-md"
              style={{
                width: `${Math.max(item.ratio * 100, 0)}%`,
                backgroundColor: item.color,
                transition: reduced ? "none" : "width 0.5s var(--ease-seijaku)",
              }}
            />
          </div>
          <div className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
            {item.displayValue}
          </div>
        </div>
      ))}
    </div>
  );
}
