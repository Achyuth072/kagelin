"use client";

import { HabitCard } from "@/components/habits/HabitCard";
import { HabitCompactList } from "@/components/habits/HabitCompactList";
import { useHabits, type HabitWithEntries } from "@/lib/hooks/useHabits";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Plus, Layers } from "lucide-react";
import { format } from "date-fns";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useUiStore } from "@/lib/store/uiStore";
import { getHabitIcon } from "@/components/habits/shared/HabitIconPicker";
import { EmptyState } from "@/components/ui/EmptyState";

import { useHabitActions } from "@/components/habits/HabitActionsProvider";
import { HabitsPageHeader } from "@/components/habits/HabitsPageHeader";

export default function HabitsPage() {
  const { data: habits, isLoading, error } = useHabits();
  const { openAddHabit, openEditHabit, openHabitInsights } = useHabitActions();
  const { trigger } = useHaptic();
  const habitViewMode = useUiStore((s) => s.habitViewMode);
  const setHabitViewMode = useUiStore((s) => s.setHabitViewMode);

  const handleOpenCreate = () => {
    trigger("toggle");
    openAddHabit();
  };

  const handleEditHabit = (habit: HabitWithEntries) => {
    trigger("toggle");
    openEditHabit(habit);
  };

  const handleViewInsights = (habit: HabitWithEntries) => {
    trigger("toggle");
    openHabitInsights(habit);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 p-6 space-y-4"
            >
              <div className="flex justify-between">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
              <Skeleton className="h-32 w-full mt-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-32 flex flex-col items-center justify-center gap-4">
        <AlertCircle
          className="w-12 h-12 text-destructive"
          strokeWidth={2.25}
        />
        <div className="text-center">
          <h2 className="type-h2">Failed to load habits</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  const today = new Date();
  const hasHabits = !!habits && habits.length > 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-124px)] md:h-dvh overflow-hidden">
      <div className="px-4 md:px-6 pt-4 pb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {format(today, "EEEE, MMMM d")}
          </p>
          <h1 className="type-h1 mt-1 text-primary">Habits</h1>
        </div>

        <HabitsPageHeader
          viewMode={habitViewMode}
          onViewModeChange={setHabitViewMode}
          onNewHabit={handleOpenCreate}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 scrollbar-hide">
        {!hasHabits ? (
          <EmptyState
            icon={Layers}
            title="No habits yet"
            description="Small changes lead to big results. Create your first habit to start tracking."
            action={{
              label: "Create Habit",
              onClick: handleOpenCreate,
              icon: Plus,
            }}
          />
        ) : habitViewMode === "compact" ? (
          <div className="pb-12">
            <HabitCompactList
              habits={habits}
              onEditHabit={handleEditHabit}
              onViewInsights={handleViewInsights}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                icon={getHabitIcon(habit.icon)}
                onEdit={() => handleEditHabit(habit)}
                onViewInsights={() => handleViewInsights(habit)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
