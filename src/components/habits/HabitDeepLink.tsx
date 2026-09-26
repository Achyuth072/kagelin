"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Habit } from "@/lib/types/habit";
import { HABIT_URL_PARAM } from "@/lib/sw/notificationClickHandler";
import { useHabitActions } from "@/components/habits/HabitActionsProvider";

// A reminder tap lands on /habits?habit=<id>; open that habit, then drop the
// param so a later tap on the same reminder navigates (and opens it) again.
export function HabitDeepLink({ habits }: { habits: Habit[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openHabitInsights } = useHabitActions();
  const habitId = searchParams.get(HABIT_URL_PARAM);

  useEffect(() => {
    if (!habitId) return;
    const habit = habits.find((h) => h.id === habitId);
    if (habit) openHabitInsights(habit);
    router.replace("/habits");
  }, [habitId, habits, openHabitInsights, router]);

  return null;
}
