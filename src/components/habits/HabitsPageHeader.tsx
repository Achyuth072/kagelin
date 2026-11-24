"use client";

import { Plus, LayoutGrid, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { HabitOptionsMenu } from "@/components/habits/HabitOptionsMenu";
import * as m from "motion/react-m";
import { SEIJAKU_SPRING_FAST } from "@/lib/motion";

interface HabitsPageHeaderProps {
  viewMode: "grid" | "compact";
  onViewModeChange: (mode: "grid" | "compact") => void;
  onNewHabit: () => void;
}

export function HabitsPageHeader({
  viewMode,
  onViewModeChange,
  onNewHabit,
}: HabitsPageHeaderProps) {
  const { trigger } = useHaptic();

  return (
    <div className="flex items-center gap-2 shrink-0 max-md:justify-between">
      <Tabs
        value={viewMode}
        onValueChange={(v) => {
          trigger("toggle");
          onViewModeChange(v as "grid" | "compact");
        }}
        className="h-10"
      >
        <TabsList>
          <TabsTrigger
            value="grid"
            className="relative px-2.5 data-[state=active]:bg-transparent data-[state=active]:border-transparent data-[state=active]:shadow-none"
          >
            {viewMode === "grid" && (
              <m.span
                layoutId="habits-view-pill"
                transition={SEIJAKU_SPRING_FAST}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-md bg-card border border-border shadow-xs"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <LayoutGrid strokeWidth={2.25} aria-hidden="true" />
              <span className="hidden md:inline">Grid</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="compact"
            className="relative px-2.5 data-[state=active]:bg-transparent data-[state=active]:border-transparent data-[state=active]:shadow-none"
          >
            {viewMode === "compact" && (
              <m.span
                layoutId="habits-view-pill"
                transition={SEIJAKU_SPRING_FAST}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-md bg-card border border-border shadow-xs"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Rows3 strokeWidth={2.25} aria-hidden="true" />
              <span className="hidden md:inline">Compact</span>
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        onClick={onNewHabit}
        className="hidden md:flex h-9 items-center gap-2 px-4 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 border-none shadow-sm shadow-brand/10 transition-seijaku text-[13px] font-semibold"
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} />
        <span>New Habit</span>
      </Button>
      <HabitOptionsMenu />
    </div>
  );
}
