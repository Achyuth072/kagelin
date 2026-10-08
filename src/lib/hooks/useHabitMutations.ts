"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { handleMutationError } from "@/lib/utils/mutation-error";
import { applyReadableUpdate } from "@/lib/crypto/unreadable";
import type { HabitEntry, HabitWithEntries } from "@/lib/types/habit";
import { REMINDER_EVERY_DAY } from "@/lib/types/habit";
import { getCurrentStreak } from "@/lib/utils/habit-streak";
import { trackTelemetry } from "@/lib/telemetry/client";
import { mockStore } from "@/lib/mock/mock-store";

import { habitMutations } from "@/lib/mutations/habit";
import type { CreateHabitInput, UpdateHabitInput } from "@/lib/mutations/habit";

export function useCreateHabit() {
  const queryClient = useQueryClient();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationKey: ["createHabit"],
    mutationFn: habitMutations.create,
    onMutate: async (input: CreateHabitInput) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });

      const snapshot = queryClient.getQueriesData<HabitWithEntries[]>({
        queryKey: ["habits"],
      });

      const allHabits = snapshot.flatMap(([, data]) => data ?? []);
      const maxOrder = allHabits.reduce(
        (max, h) => Math.max(max, h.sort_order ?? 0),
        -1,
      );

      const tempId = crypto.randomUUID();
      const today = new Date().toISOString().split("T")[0];
      const now = new Date().toISOString();

      const optimisticHabit: HabitWithEntries = {
        id: tempId,
        user_id: isGuestMode ? "guest" : "",
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? "#4B6CB7",
        icon: input.icon ?? null,
        start_date: input.start_date ?? today,
        archived_at: input.archived_at ?? null,
        sort_order: maxOrder + 1,
        habit_type: input.habit_type ?? "boolean",
        frequency_count: input.frequency_count ?? null,
        frequency_days: input.frequency_days ?? null,
        frequency_period: input.frequency_period ?? null,
        target_type: input.target_type ?? null,
        target_value: input.target_value ?? null,
        unit: input.unit ?? null,
        question: input.question ?? null,
        reminder_time: input.reminder_time ?? null,
        reminder_days: input.reminder_days ?? REMINDER_EVERY_DAY,
        source_uuid: input.source_uuid ?? null,
        created_at: now,
        updated_at: now,
        entries: [],
      };

      snapshot.forEach(([key, data]) => {
        const params = key[1] as { includeArchived: boolean } | undefined;
        const includeArchived = params?.includeArchived ?? true;
        if (!includeArchived && optimisticHabit.archived_at) return;
        queryClient.setQueryData<HabitWithEntries[]>(key, [
          ...(data ?? []),
          optimisticHabit,
        ]);
      });

      return { snapshot, tempId };
    },
    onError: (err, _input, context) => {
      rollBack(queryClient, context?.snapshot);
      handleMutationError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["updateHabit"],
    mutationFn: habitMutations.update,
    onMutate: async (input: UpdateHabitInput) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });

      const snapshot = queryClient.getQueriesData<HabitWithEntries[]>({
        queryKey: ["habits"],
      });

      const { id, ...updates } = input;
      snapshot.forEach(([key]) => {
        queryClient.setQueryData<HabitWithEntries[]>(key, (old) =>
          old?.map((h) => (h.id === id ? applyReadableUpdate(h, updates) : h)),
        );
      });

      return { snapshot };
    },
    onError: (err, _input, context) => {
      rollBack(queryClient, context?.snapshot);
      handleMutationError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

type HabitsSnapshot = [readonly unknown[], HabitWithEntries[] | undefined][];

// Habits are cached per {includeArchived, isGuestMode}; prefix-matching keeps
// every variant in step and rolls all of them back from one snapshot.
function rollBack(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot?: HabitsSnapshot,
) {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

function useSetHabitArchived(archive: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [archive ? "archiveHabit" : "unarchiveHabit"],
    mutationFn: (habitId: string) =>
      habitMutations.update({
        id: habitId,
        archived_at: archive ? new Date().toISOString() : null,
      }),
    onMutate: async (habitId) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });
      const snapshot = queryClient.getQueriesData<HabitWithEntries[]>({
        queryKey: ["habits"],
      });
      const target = snapshot
        .flatMap(([, data]) => data ?? [])
        .find((h) => h.id === habitId);
      const archivedAt = archive ? new Date().toISOString() : null;
      const isAllSlice = (key: readonly unknown[]) =>
        (key[1] as { includeArchived: boolean }).includeArchived;

      queryClient.setQueriesData<HabitWithEntries[]>(
        { queryKey: ["habits"], predicate: (q) => isAllSlice(q.queryKey) },
        (old) =>
          old?.map((h) =>
            h.id === habitId ? { ...h, archived_at: archivedAt } : h,
          ),
      );
      queryClient.setQueriesData<HabitWithEntries[]>(
        { queryKey: ["habits"], predicate: (q) => !isAllSlice(q.queryKey) },
        (old) => {
          if (!old) return old;
          if (archive) return old.filter((h) => h.id !== habitId);
          if (!target || old.some((h) => h.id === habitId)) return old;
          return [...old, { ...target, archived_at: null }].sort(
            (a, b) => a.sort_order - b.sort_order,
          );
        },
      );
      return { snapshot };
    },
    onError: (err, _vars, context) => {
      rollBack(queryClient, context?.snapshot);
      handleMutationError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useArchiveHabit() {
  return useSetHabitArchived(true);
}

export function useUnarchiveHabit() {
  return useSetHabitArchived(false);
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["deleteHabit"],
    mutationFn: habitMutations.delete,
    onMutate: async (habitId) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });
      const snapshot = queryClient.getQueriesData<HabitWithEntries[]>({
        queryKey: ["habits"],
      });
      queryClient.setQueriesData<HabitWithEntries[]>(
        { queryKey: ["habits"] },
        (old) => old?.filter((habit) => habit.id !== habitId),
      );
      return { snapshot };
    },
    onError: (err, _vars, context) => {
      rollBack(queryClient, context?.snapshot);
      handleMutationError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useReorderHabits() {
  const queryClient = useQueryClient();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationKey: ["reorderHabits"],
    mutationFn: habitMutations.reorder,
    onMutate: async (pairs: { id: string; sort_order: number }[]) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });

      const queryKey = ["habits", { includeArchived: false, isGuestMode }];
      const previousHabits =
        queryClient.getQueryData<HabitWithEntries[]>(queryKey);

      queryClient.setQueryData<HabitWithEntries[]>(queryKey, (old) => {
        if (!old) return old;
        const sortOrderById = new Map(pairs.map((p) => [p.id, p.sort_order]));
        return old
          .map((habit) =>
            sortOrderById.has(habit.id)
              ? { ...habit, sort_order: sortOrderById.get(habit.id)! }
              : habit,
          )
          .sort((a, b) => a.sort_order - b.sort_order);
      });

      return { previousHabits, queryKey };
    },
    onError: (err, _vars, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(context.queryKey, context.previousHabits);
      }
      handleMutationError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useMarkHabitComplete() {
  const queryClient = useQueryClient();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationKey: ["markHabitComplete"],
    mutationFn: habitMutations.markComplete,
    onMutate: async ({ habitId, date, value = 1 }) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });

      const previousHabits = queryClient.getQueryData<HabitWithEntries[]>([
        "habits",
        { includeArchived: false, isGuestMode },
      ]);

      queryClient.setQueryData<HabitWithEntries[]>(
        ["habits", { includeArchived: false, isGuestMode }],
        (old) =>
          old?.map((habit) => {
            if (habit.id !== habitId) return habit;

            if (value === null) {
              return {
                ...habit,
                entries: habit.entries.filter((e) => e.date !== date),
              };
            }

            const existingEntryIndex = habit.entries.findIndex(
              (e) => e.date === date,
            );

            if (existingEntryIndex >= 0) {
              const updatedEntries = [...habit.entries];
              updatedEntries[existingEntryIndex] = {
                ...updatedEntries[existingEntryIndex],
                value,
              };
              return { ...habit, entries: updatedEntries };
            } else {
              const newEntry: HabitEntry = {
                id: crypto.randomUUID(),
                habit_id: habitId,
                date,
                value,
                created_at: new Date().toISOString(),
              };
              return {
                ...habit,
                entries: [...habit.entries, newEntry],
              };
            }
          }),
      );

      return { previousHabits };
    },
    onSuccess: (_data, variables) => {
      // Guests get a year of pre-seeded demo habits; interacting with them
      // shouldn't inflate the "Habit Consistency" telemetry KPI.
      if (isGuestMode && mockStore.isSeedId(variables.habitId)) return;

      if (variables.value !== null && (variables.value ?? 1) >= 1) {
        const habits = queryClient.getQueryData<HabitWithEntries[]>([
          "habits",
          { includeArchived: false, isGuestMode },
        ]);
        const habit = habits?.find((h) => h.id === variables.habitId);
        let streakMilestone: "7" | "30" | "100" | undefined;
        if (habit) {
          const streak = getCurrentStreak(habit, habit.entries);
          if (streak === 7) streakMilestone = "7";
          else if (streak === 30) streakMilestone = "30";
          else if (streak === 100) streakMilestone = "100";
        }
        trackTelemetry(
          "habit_logged",
          streakMilestone ? { streak_milestone: streakMilestone } : {},
        );
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode }],
          context.previousHabits,
        );
      }
      handleMutationError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}
