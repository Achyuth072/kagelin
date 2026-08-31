import { CheckCircle2, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProgressBadgeProps {
  completed: number;
  total: number;
  className?: string;
}

export function StepProgressBadge({
  completed,
  total,
  className,
}: StepProgressBadgeProps) {
  if (total <= 0) return null;

  const allCompleted = completed === total;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider whitespace-nowrap",
        allCompleted
          ? "text-green-600 dark:text-green-500 font-bold"
          : "text-muted-foreground/70",
        className,
      )}
      data-testid="step-progress-badge"
    >
      {allCompleted ? (
        <CheckCircle2
          className="h-3 w-3 text-green-600 dark:text-green-500"
          strokeWidth={2.5}
        />
      ) : (
        <ListChecks className="h-3 w-3" strokeWidth={2.5} />
      )}
      {completed}/{total}
    </span>
  );
}
