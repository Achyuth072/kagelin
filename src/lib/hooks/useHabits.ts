"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { Habit, HabitEntry, HabitWithEntries } from "@/lib/types/habit";

export type { HabitEntry, HabitWithEntries };

function fetchAllHabitEntries(
  supabase: ReturnType<typeof createClient>,
  habitIds: string[],
): Promise<HabitEntry[]> {
  if (habitIds.length === 0) return Promise.resolve([]);
  return fetchAllRows<HabitEntry>((from, to) =>
    supabase
      .from("habit_entries")
      .select("*")
      .in("habit_id", habitIds)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}

function groupEntriesByHabit(entries: HabitEntry[]): Map<string, HabitEntry[]> {
  const map = new Map<string, HabitEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.habit_id);
    if (list) list.push(entry);
    else map.set(entry.habit_id, [entry]);
  }
  return map;
}

interface UseHabitsOptions {
  includeArchived?: boolean;
}

export function useHabits(options: UseHabitsOptions = {}) {
  const { includeArchived = false } = options;
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["habits", { includeArchived, isGuestMode }],
    staleTime: 60000,
    queryFn: async (): Promise<HabitWithEntries[]> => {
      if (isGuestMode) {
        const habits = [...mockStore.getHabits()].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
        const entries = mockStore.getHabitEntries();
        const filteredHabits = includeArchived
          ? habits
          : habits.filter((h) => !h.archived_at);
        const entriesByHabit = groupEntriesByHabit(entries);

        return filteredHabits.map((habit) => ({
          ...habit,
          entries: entriesByHabit.get(habit.id) || [],
        }));
      }

      const supabase = createClient();
      // eslint-disable-next-line local/no-unbounded-supabase-select -- habit definitions, not entries
      let habitsQuery = supabase
        .from("habits")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!includeArchived) {
        habitsQuery = habitsQuery.is("archived_at", null);
      }

      const { data: habits, error: habitsError } = await habitsQuery;
      if (habitsError) throw new Error(habitsError.message);
      if (!habits || habits.length === 0) return [];

      const habitIds = habits.map((h) => h.id);
      const entries = await fetchAllHabitEntries(supabase, habitIds);
      const entriesByHabit = groupEntriesByHabit(entries);

      return habits.map((habit) => ({
        ...(habit as Habit),
        entries: entriesByHabit.get(habit.id) || [],
      }));
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useHabit(habitId: string | null) {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["habit", habitId, isGuestMode],
    staleTime: 60000,
    queryFn: async (): Promise<HabitWithEntries | null> => {
      if (!habitId) return null;

      if (isGuestMode) {
        const habits = mockStore.getHabits();
        const habit = habits.find((h) => h.id === habitId);
        if (!habit) return null;

        const entries = mockStore.getHabitEntries(habitId);
        return {
          ...habit,
          entries,
        };
      }

      const supabase = createClient();
      const { data: habit, error: habitError } = await supabase
        .from("habits")
        .select("*")
        .eq("id", habitId)
        .single();

      if (habitError) {
        throw new Error(habitError.message);
      }

      const entries = await fetchAllHabitEntries(supabase, [habitId]);

      return {
        ...(habit as Habit),
        entries,
      };
    },
    enabled: !!habitId,
    placeholderData: (previousData) => previousData,
  });
}
