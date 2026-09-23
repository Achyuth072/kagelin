import { useMarkHabitComplete } from "@/lib/hooks/useHabitMutations";
import { cycleEntry } from "@/lib/utils/habit-entry-session";
import type { HabitWithEntries } from "@/lib/types/habit";
export function useHabitCellActions(habit: HabitWithEntries) {
  const markComplete = useMarkHabitComplete();

  const onToggle = (date: string) => {
    const current = habit.entries.find((e) => e.date === date)?.value ?? null;
    markComplete.mutate({
      habitId: habit.id,
      date,
      value: cycleEntry(habit.id, date, current),
    });
  };

  const onLogValue = (date: string, value: number) => {
    markComplete.mutate({ habitId: habit.id, date, value });
  };

  const onClearValue = (date: string) => {
    markComplete.mutate({ habitId: habit.id, date, value: null });
  };

  return { onToggle, onLogValue, onClearValue };
}
