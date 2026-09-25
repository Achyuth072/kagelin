import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";
import {
  REMINDER_EVERY_DAY,
  type Habit,
  type HabitEntry,
  type HabitType,
} from "@/lib/types/habit";

export interface CreateHabitInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  start_date?: string;
  archived_at?: string | null;
  habit_type?: HabitType;
  frequency_count?: number;
  frequency_period?: "day" | "week" | "month";
  target_type?: "at_least" | "at_most";
  target_value?: number;
  unit?: string;
  question?: string | null;
  reminder_time?: string | null;
  reminder_days?: number;
  source_uuid?: string;
  sort_order?: number;
}

export interface UpdateHabitInput {
  id: string;
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  habit_type?: HabitType;
  frequency_count?: number;
  frequency_period?: "day" | "week" | "month";
  target_type?: "at_least" | "at_most";
  target_value?: number | null;
  unit?: string;
  question?: string | null;
  reminder_time?: string | null;
  reminder_days?: number;
  archived_at?: string | null;
}

export interface MarkHabitCompleteInput {
  habitId: string;
  date: string;
  value?: number | null;
  notes?: string | null;
}

export const habitMutations = {
  create: async (input: CreateHabitInput): Promise<Habit> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    const habit_type = input.habit_type || "boolean";
    const isMeasurable = habit_type === "measurable";

    const habitData = {
      name: input.name,
      description: input.description || null,
      color: input.color || "#4B6CB7",
      icon: input.icon || null,
      archived_at: input.archived_at ?? null,
      start_date: input.start_date || new Date().toISOString().split("T")[0],
      habit_type,
      frequency_count: input.frequency_count ?? null,
      frequency_period: input.frequency_period || "day",
      target_type: isMeasurable ? input.target_type || "at_least" : null,
      target_value: isMeasurable ? (input.target_value ?? null) : null,
      unit: isMeasurable ? input.unit || null : null,
      question: input.question || null,
      reminder_time: input.reminder_time ?? null,
      reminder_days: input.reminder_days ?? REMINDER_EVERY_DAY,
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

    // Bulk callers (e.g. import) pass sort_order to skip this lookup.
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
      habit_type,
      frequency_count,
      frequency_period,
      target_type,
      target_value,
      unit,
      question,
      reminder_time,
      reminder_days,
      archived_at,
    } = input;

    const updates: Partial<Habit> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (habit_type !== undefined) updates.habit_type = habit_type;
    if (frequency_count !== undefined)
      updates.frequency_count = frequency_count;
    if (frequency_period !== undefined)
      updates.frequency_period = frequency_period;
    if (target_type !== undefined) updates.target_type = target_type;
    if (target_value !== undefined) updates.target_value = target_value;
    if (unit !== undefined) updates.unit = unit;
    if (question !== undefined) updates.question = question;
    if (reminder_time !== undefined) updates.reminder_time = reminder_time;
    if (reminder_days !== undefined) updates.reminder_days = reminder_days;
    if (archived_at !== undefined) updates.archived_at = archived_at;
    if (habit_type === "boolean") {
      updates.target_type = null;
      updates.target_value = null;
      updates.unit = null;
    }

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

  markComplete: async (
    input: MarkHabitCompleteInput,
  ): Promise<HabitEntry | null> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    const { habitId, date, value = 1, notes } = input;

    if (isGuest) {
      if (value === null) {
        mockStore.clearHabitEntry(habitId, date);
        return null;
      }
      return mockStore.setHabitEntry(habitId, date, value, notes);
    }

    const supabase = createClient();
    if (value === null) {
      const { error } = await supabase
        .from("habit_entries")
        .delete()
        .eq("habit_id", habitId)
        .eq("date", date);
      if (error) throw new Error(error.message);
      return null;
    }

    const payload: {
      habit_id: string;
      date: string;
      value: number;
      notes?: string | null;
    } = {
      habit_id: habitId,
      date,
      value,
    };
    if (notes !== undefined) {
      payload.notes = notes;
    }

    const { data, error } = await supabase
      .from("habit_entries")
      .upsert(payload, { onConflict: "habit_id,date" })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as HabitEntry;
  },
};
