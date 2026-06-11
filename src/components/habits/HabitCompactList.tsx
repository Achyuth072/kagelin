"use client";

import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { getHabitIcon } from "@/components/habits/shared/HabitIconPicker";
import { HabitCompactRow } from "./HabitCompactRow";

interface HabitCompactListProps {
  habits: HabitWithEntries[];
  onEditHabit: (habit: HabitWithEntries) => void;
}

/**
 * Folio-continuous compact view: one container, rows separated by border-b
 * (DESIGN_SYSTEM List geometry).
 */
export function HabitCompactList({
  habits,
  onEditHabit,
}: HabitCompactListProps) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {habits.map((habit) => (
        <HabitCompactRow
          key={habit.id}
          habit={habit}
          icon={getHabitIcon(habit.icon)}
          onEdit={() => onEditHabit(habit)}
        />
      ))}
    </div>
  );
}
