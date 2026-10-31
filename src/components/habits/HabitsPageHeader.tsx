"use client";

import { Plus, LayoutGrid, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { HabitOptionsMenu } from "@/components/habits/HabitOptionsMenu";

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
          <TabsTrigger value="grid" className="px-2.5">
            <LayoutGrid strokeWidth={2.25} aria-hidden="true" />
            <span className="hidden md:inline">Grid</span>
          </TabsTrigger>
          <TabsTrigger value="compact" className="px-2.5">
            <Rows3 strokeWidth={2.25} aria-hidden="true" />
            <span className="hidden md:inline">Compact</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        onClick={onNewHabit}
        className="hidden md:flex h-9 items-center gap-2 px-4 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 border-none shadow-sm shadow-brand/10 transition-seijaku text-[13px] font-semibold"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        <span>New Habit</span>
      </Button>
      <HabitOptionsMenu />
    </div>
  );
}
