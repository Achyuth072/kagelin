"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PriorityGlyphProps {
  level?: number | null;
  className?: string;
}

export function PriorityGlyph({ level, className }: PriorityGlyphProps) {
  if (level == null || level >= 4 || level < 1) return null;

  return (
    <span
      role="img"
      className={cn(
        "inline-flex items-end gap-[1.5px] w-3.5 h-3.5 pb-0.5 justify-center flex-shrink-0",
        className,
      )}
      title={`Priority P${level}`}
      aria-label={`Priority P${level}`}
    >
      <span
        className={cn(
          "w-[2.5px] rounded-[0.5px] bg-foreground transition-all",
          level <= 3 ? "h-1.5 opacity-100" : "h-1 opacity-20",
        )}
      />
      <span
        className={cn(
          "w-[2.5px] rounded-[0.5px] bg-foreground transition-all",
          level <= 2 ? "h-2.5 opacity-100" : "h-1 opacity-20",
        )}
      />
      <span
        className={cn(
          "w-[2.5px] rounded-[0.5px] bg-foreground transition-all",
          level === 1 ? "h-3.5 opacity-100" : "h-1 opacity-20",
        )}
      />
    </span>
  );
}
