"use client";

import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import {
  ReadableText,
  UNREADABLE_LABEL,
} from "@/components/encryption/ReadableText";

export interface StatsBarListItem {
  key: string;
  label: string | null;
  displayValue: string;
  color: string;
  ratio: number; // 0..1
}

interface StatsBarListProps {
  items: StatsBarListItem[];
  className?: string;
  labelWidthClassName?: string;
}

export function StatsBarList({
  items,
  className,
  labelWidthClassName = "w-28",
}: StatsBarListProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <div className={cn("space-y-3.5 sm:space-y-3", className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3"
        >
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto min-w-0">
            <div
              className={cn(
                "flex items-center gap-2 min-w-0 sm:shrink-0",
                labelWidthClassName,
              )}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: item.color }}
              />
              <span
                className="truncate text-sm text-muted-foreground"
                title={item.label ?? UNREADABLE_LABEL}
              >
                <ReadableText text={item.label} />
              </span>
            </div>
            <div className="sm:hidden text-right text-sm tabular-nums text-muted-foreground shrink-0 font-medium">
              {item.displayValue}
            </div>
          </div>
          <div className="w-full sm:w-auto sm:flex-1 h-3 sm:h-4 shrink-0 rounded-[3px] bg-secondary/50 overflow-hidden">
            <div
              className="h-full rounded-[3px] bg-foreground/70"
              style={{
                width: `${Math.max(item.ratio * 100, 0)}%`,
                transition: reduced ? "none" : "width 0.5s var(--ease-seijaku)",
              }}
            />
          </div>
          <div className="hidden sm:block w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
            {item.displayValue}
          </div>
        </div>
      ))}
    </div>
  );
}
