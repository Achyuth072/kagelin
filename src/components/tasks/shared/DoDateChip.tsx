"use client";

import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDoDate } from "@/components/tasks/task-utils";

interface DoDateChipProps {
  doDate?: string | null;
  isCompleted?: boolean;
  className?: string;
}

export function DoDateChip({
  doDate,
  isCompleted,
  className,
}: DoDateChipProps) {
  if (!doDate) return null;
  const doDateInfo = formatDoDate(doDate, isCompleted);
  if (!doDateInfo) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border",
        doDateInfo.isPlannedToday
          ? "bg-secondary/70 border-border/80 text-foreground font-semibold"
          : doDateInfo.isRescheduleNeeded
            ? "bg-secondary/40 border-border/60 text-muted-foreground border-dashed"
            : "bg-secondary/35 border-border/40 text-muted-foreground",
        className,
      )}
      title={doDateInfo.isRescheduleNeeded ? "Needs rescheduling" : undefined}
      aria-label={
        doDateInfo.isRescheduleNeeded
          ? `${doDateInfo.text} (Needs rescheduling)`
          : undefined
      }
    >
      <CalendarClock className="h-3 w-3" strokeWidth={2.25} />
      <span>{doDateInfo.text}</span>
    </span>
  );
}
