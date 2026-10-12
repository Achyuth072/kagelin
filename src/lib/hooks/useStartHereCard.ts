"use client";

import { useEffect, useCallback } from "react";
import {
  useUiStore,
  getStartHereState,
  type StartHereState,
  type StepId,
} from "@/lib/store/uiStore";
import { useDemoMode } from "@/lib/hooks/useDemoMode";
import { useTasks } from "@/lib/hooks/useTasks";
import { useHabits } from "@/lib/hooks/useHabits";
import { useHasFocusLog } from "@/lib/hooks/useHasFocusLog";

export function useStartHereCard(userId: string) {
  const startHereStates = useUiStore((state) => state.startHereStates);
  const setStartHereState = useUiStore((state) => state.setStartHereState);
  const state = getStartHereState(userId, startHereStates);

  // Wait for demo check to settle: deciding while loading risks misclassifying demo accounts.
  const isDemoMode = useDemoMode();

  const tasksQuery = useTasks({ projectId: "all" });
  const habitsQuery = useHabits();
  const focusQuery = useHasFocusLog();
  const tasks = tasksQuery.data;
  const habits = habitsQuery.data;
  const hasFocusLog = focusQuery.data;

  const loaded = !!tasks && !!habits && hasFocusLog !== undefined;
  // Wait for background refetch so persisted cache isn't evaluated as fresh data.
  const settled =
    loaded &&
    !tasksQuery.isFetching &&
    !habitsQuery.isFetching &&
    !focusQuery.isFetching;

  const seenTask = !!tasks?.some(
    (t) => t.project_id !== state?.tutorialProjectId,
  );
  const seenHabit = !!habits?.length;
  const seenFocus = !!hasFocusLog;
  const seenImport = !!habits?.some((h) => !!h.source_uuid);

  const seen: Record<StepId, boolean> = {
    task: seenTask,
    habit: seenHabit,
    focus: seenFocus,
    import: seenImport,
  };

  const done = (id: StepId) => seen[id] || !!state?.done?.includes(id);

  const save = useCallback(
    (next: StartHereState) => {
      if (!userId) return;
      setStartHereState(userId, next);
    },
    [userId, setStartHereState],
  );

  useEffect(() => {
    if (!userId || !loaded) return;
    const pendingDone: StepId[] = [];
    if (seenTask && !state?.done?.includes("task")) pendingDone.push("task");
    if (seenHabit && !state?.done?.includes("habit")) pendingDone.push("habit");
    if (seenFocus && !state?.done?.includes("focus")) pendingDone.push("focus");
    if (seenImport && !state?.done?.includes("import"))
      pendingDone.push("import");

    if (!state) {
      if (!settled) return;
      save({
        eligible: !seenTask && !seenHabit && !seenFocus,
        dismissed: false,
        done: pendingDone,
      });
    } else if (pendingDone.length > 0) {
      save({ ...state, done: [...state.done, ...pendingDone] });
    }
  }, [
    userId,
    loaded,
    settled,
    state,
    seenTask,
    seenHabit,
    seenFocus,
    seenImport,
    save,
  ]);

  const isVisible =
    !!userId &&
    isDemoMode === false &&
    !state?.dismissed &&
    state?.eligible !== false &&
    loaded &&
    !!state;

  return {
    state,
    save,
    loaded,
    isVisible,
    done,
  };
}
