"use client";

import type { Ref } from "react";
import { cn } from "@/lib/utils";
import {
  HOUR_HEIGHT,
  HEADER_HEIGHT,
  hours,
  HOUR_LABELS,
} from "@/lib/calendar/grid-constants";

export function TimeGutter({
  className,
  ref,
}: {
  className?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      data-testid="time-gutter"
      className={cn(
        "w-12 md:w-16 shrink-0 sticky left-0 z-50 bg-background border-r border-border/40 h-fit",
        className,
      )}
    >
      <div className="bg-background" style={{ height: `${HEADER_HEIGHT}px` }} />
      {hours.map((hour) => (
        <div
          key={hour}
          className="text-[9px] md:text-xs text-muted-foreground/50 text-right pr-2 md:pr-3 pt-2 font-medium bg-background"
          style={{ height: `${HOUR_HEIGHT}px` }}
        >
          {HOUR_LABELS[hour]}
        </div>
      ))}
    </div>
  );
}
