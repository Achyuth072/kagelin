"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useCurrentTime } from "@/lib/hooks/useCurrentTime";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import { HOUR_HEIGHT, HEADER_HEIGHT } from "@/lib/calendar/grid-constants";

interface CurrentTimeIndicatorProps {
  className?: string;
}

export function CurrentTimeIndicator({ className }: CurrentTimeIndicatorProps) {
  const now = useCurrentTime(60000);
  const { formatTime } = useTimeFormat();

  const topPx = useMemo(() => {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return hours * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT + HEADER_HEIGHT;
  }, [now]);

  return (
    <div
      data-testid="current-time-indicator"
      className={cn(
        "absolute left-0 right-0 z-30 h-0 overflow-visible pointer-events-none transition-all duration-500 ease-in-out",
        className,
      )}
      style={{ top: `${topPx}px` }}
    >
      <div className="absolute left-0 right-0 h-[2px] bg-brand/60 -translate-y-1/2" />

      {/* Painted after the line, so it stacks on top. */}
      <div className="absolute left-0 flex items-center h-0 overflow-visible -translate-y-1/2">
        <div className="rounded-full bg-brand w-[2px] h-4 md:h-5" />
        <span className="rounded bg-brand text-white font-bold leading-none whitespace-nowrap shadow-sm ml-2 px-1.5 py-0.5 text-[9px] md:text-[10px] uppercase tracking-wider">
          {formatTime(now)}
        </span>
      </div>
    </div>
  );
}
