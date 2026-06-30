"use client";

import { Flag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  StatsBarList,
  type StatsBarListItem,
} from "@/components/stats/StatsBarList";
import type { PriorityBreakdownCount } from "@/lib/hooks/useStats";
import { cn } from "@/lib/utils";

const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
};

// A single-accent opacity ramp (no new hues) — P1 strongest, P4 faintest.
const PRIORITY_OPACITY: Record<1 | 2 | 3 | 4, number> = {
  1: 1,
  2: 0.7,
  3: 0.45,
  4: 0.25,
};

interface PriorityBreakdownCardProps {
  data: PriorityBreakdownCount[];
  className?: string;
}

export function PriorityBreakdownCard({
  data,
  className,
}: PriorityBreakdownCardProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);

  const items: StatsBarListItem[] = data.map((d) => ({
    key: String(d.priority),
    label: PRIORITY_LABELS[d.priority],
    displayValue: String(d.count),
    color: `hsl(var(--brand) / ${PRIORITY_OPACITY[d.priority]})`,
    ratio: max > 0 ? d.count / max : 0,
  }));

  return (
    <Card className={cn("p-6 border-border/50", className)}>
      <div className="space-y-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          By Priority
        </h3>
        {total === 0 ? (
          <EmptyState
            icon={Flag}
            title="No completed tasks"
            description="Complete a task to see this breakdown."
            className="py-8 gap-3"
          />
        ) : (
          <StatsBarList items={items} />
        )}
      </div>
    </Card>
  );
}
