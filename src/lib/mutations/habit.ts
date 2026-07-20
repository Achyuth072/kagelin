import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";
import type { Habit, HabitEntry } from "@/lib/types/habit";

export interface CreateHabitInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  start_date?: string;
  habitType?: "boolean" | "measurable";
  frequencyCount?: number;
  frequencyPeriod?: "day" | "week" | "month";
  targetType?: "at_least" | "at_most";
  targetValue?: number;
  unit?: string;
  source_uuid?: string;
  sort_order?: number;
}

interface UpdateHabitInput {
  id: string;
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  habitType?: "boolean" | "measurable";
  frequencyCount?: number;
  frequencyPeriod?: "day" | "week" | "month";
  targetType?: "at_least" | "at_most";
  targetValue?: number;
  unit?: string;
}

interface MarkHabitCompleteInput {
  habitId: string;
  date: string;
  value?: number;
}

export const habitMutations = {
  create: async (input: CreateHabitInput): Promise<Habit> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    const habitData = {
      name: input.name,
      description: input.description || null,
      color: input.color || "#4B6CB7",
      icon: input.icon || null,
      archived_at: null,
      start_date: input.start_date || new Date().toISOString().split("T")[0],
      habit_type: input.habitType || "boolean",
      frequency_count: input.frequencyCount ?? null,
      frequency_period: input.frequencyPeriod || "day",
      target_type: input.targetType || "at_least",
      target_value: input.targetValue ?? null,
      unit: input.unit || null,
      source_uuid: input.source_uuid ?? null,
    };

    if (isGuest) {
      return mockStore.addHabit(habitData);
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    // Append to the bottom: new habit gets max(sort_order) + 1 for the user.
    // Bulk callers (e.g. import) can pass sort_order to skip this lookup.
    let nextSortOrder = input.sort_order;
    if (nextSortOrder === undefined) {
      const { data: lastHabit } = await supabase
        .from("habits")
        .select("sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      nextSortOrder = (lastHabit?.sort_order ?? -1) + 1;
    }

    const { data, error } = await supabase
      .from("habits")
      .insert({
        user_id: user.id,
        ...habitData,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Habit;
  },

  update: async (input: UpdateHabitInput): Promise<Habit> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";
    const {
      id,
      name,
      description,
      color,
      icon,
      habitType,
      frequencyCount,
      frequencyPeriod,
      targetType,
      targetValue,
      unit,
    } = input;

    const updates: Partial<Habit> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (habitType !== undefined) updates.habit_type = habitType;
    if (frequencyCount !== undefined) updates.frequency_count = frequencyCount;
    if (frequencyPeriod !== undefined)
      updates.frequency_period = frequencyPeriod;
    if (targetType !== undefined) updates.target_type = targetType;
    if (targetValue !== undefined) updates.target_value = targetValue;
    if (unit !== undefined) updates.unit = unit;

    if (isGuest) {
      const result = mockStore.updateHabit(id, updates);
      if (!result) throw new Error("Habit not found");
      return result;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("habits")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Habit;
  },

  delete: async (habitId: string): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      const success = mockStore.deleteHabit(habitId);
      if (!success) throw new Error("Habit not found");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("habits").delete().eq("id", habitId);
    if (error) throw new Error(error.message);
  },

  // Accepts pre-computed {id, sort_order} pairs from computeReorderPairs in
  // useReorderHabits.onMutate. Each habit receives the sort_order of the slot it
  // is moving into, so the flat list stays stable after the DB-sorted refetch.
  reorder: async (
    pairs: { id: string; sort_order: number }[],
  ): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      pairs.forEach(({ id, sort_order }) => {
        mockStore.updateHabit(id, { sort_order });
      });
      return;
    }

    const supabase = createClient();

    // Single transactional RPC so the multi-row update commits atomically — a
    // partial failure can't leave the DB in a half-reordered state.
    const { error } = await supabase.rpc("reorder_habits", { updates: pairs });
    if (error) throw new Error(error.message);
  },

  markComplete: async (input: MarkHabitCompleteInput): Promise<HabitEntry> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    const { habitId, date, value = 1 } = input;

    if (isGuest) {
      const entry = mockStore.setHabitEntry(habitId, date, value);
      return entry || ({ habit_id: habitId, date, value: 0 } as HabitEntry);
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("habit_entries")
      .upsert(
        { habit_id: habitId, date, value },
        { onConflict: "habit_id,date" },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as HabitEntry;
  },
};
