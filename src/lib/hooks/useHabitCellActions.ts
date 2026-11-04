import { useMarkHabitComplete } from "@/lib/hooks/useHabitMutations";
import { cycleEntry } from "@/lib/utils/habit-entry-session";
import { ENTRY_VALUE_SKIPPED, type HabitWithEntries } from "@/lib/types/habit";
import { notify } from "@/lib/notify";
import { useHaptic } from "@/lib/hooks/useHaptic";

export function useHabitCellActions(habit: HabitWithEntries) {
  const markComplete = useMarkHabitComplete();
  const { trigger } = useHaptic();

  const onToggle = (date: string) => {
    const current = habit.entries.find((e) => e.date === date)?.value ?? null;
    const nextValue = cycleEntry(habit.id, date, current);
    markComplete.mutate({
      habitId: habit.id,
      date,
      value: nextValue,
    });

    if (nextValue === ENTRY_VALUE_SKIPPED) {
      notify("Marked as skipped (rest day). Tap again to clear.");
      trigger("toggle");
    } else if (nextValue === null) {
      notify("Habit entry cleared");
      trigger("thud");
    } else {
      trigger("success");
    }
  };

  const onLogValue = (date: string, value: number) => {
    markComplete.mutate({ habitId: habit.id, date, value });
  };

  const onClearValue = (date: string) => {
    markComplete.mutate({ habitId: habit.id, date, value: null });
    notify("Habit entry cleared");
    trigger("thud");
  };

  return { onToggle, onLogValue, onClearValue };
}
