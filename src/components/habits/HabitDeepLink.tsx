"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Habit } from "@/lib/types/habit";
import { HABITS_PATH, HABIT_URL_PARAM } from "@/lib/habit-links";
import { useHabitActions } from "@/components/habits/HabitActionsProvider";

export function HabitDeepLink({ habits }: { habits: Habit[] }) {
  const searchParams = useSearchParams();
  const { openHabitInsights } = useHabitActions();
  const habitId = searchParams.get(HABIT_URL_PARAM);

  useEffect(() => {
    if (!habitId) return;
    const habit = habits.find((h) => h.id === habitId);
    if (habit) openHabitInsights(habit);
    // replaceState avoids superseding useBackAnchor on cold loads.
    window.history.replaceState(window.history.state, "", HABITS_PATH);
  }, [habitId, habits, openHabitInsights]);

  return null;
}
