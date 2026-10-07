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
    <div className={cn("space-y-3", className)}>
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-3">
          <div
            className={cn(
              "flex shrink-0 items-center gap-2",
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
          <div className="flex-1 h-5 rounded-[3px] bg-secondary/40 overflow-hidden">
            <div
              className="h-full rounded-[3px] bg-foreground/70"
              style={{
                width: `${Math.max(item.ratio * 100, 0)}%`,
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
