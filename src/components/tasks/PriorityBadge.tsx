"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { PriorityGlyph } from "./PriorityGlyph";

interface PriorityBadgeProps {
  priority?: number | null;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (priority == null || priority >= 4 || priority < 1) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-secondary/35 border border-border/40 text-foreground",
        className,
      )}
    >
      <PriorityGlyph level={priority} />
      <span>P{priority}</span>
    </span>
  );
}
