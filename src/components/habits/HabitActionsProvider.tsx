"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { Habit } from "@/lib/types/habit";
import type { SheetTab } from "@/components/ui/SheetTabToggle";
import { useShortcutTips } from "@/lib/hooks/useShortcutTips";

export interface OpenHabitOptions {
  source?: "mouse" | "keyboard";
}

interface HabitActionsContextValue {
  isHabitSheetOpen: boolean;
  editingHabit: Habit | null;
  initialTab: SheetTab;
  openAddHabit: (options?: OpenHabitOptions) => void;
  openEditHabit: (habit: Habit) => void;
  openHabitInsights: (habit: Habit) => void;
  closeHabitSheet: () => void;
}

const HabitActionsContext = createContext<HabitActionsContextValue | null>(
  null,
);

export function HabitActionsProvider({ children }: { children: ReactNode }) {
  const [isHabitSheetOpen, setIsHabitSheetOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [initialTab, setInitialTab] = useState<SheetTab>("edit");
  const { recordMouseAction } = useShortcutTips();

  const openAddHabit = React.useCallback(
    (options?: OpenHabitOptions) => {
      if (options?.source !== "keyboard") {
        recordMouseAction("newHabit");
      }
      setEditingHabit(null);
      setInitialTab("edit");
      setIsHabitSheetOpen(true);
    },
    [recordMouseAction],
  );

  const openEditHabit = React.useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setInitialTab("edit");
    setIsHabitSheetOpen(true);
  }, []);

  const openHabitInsights = React.useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setInitialTab("insights");
    setIsHabitSheetOpen(true);
  }, []);

  const closeHabitSheet = React.useCallback(() => {
    setIsHabitSheetOpen(false);
  }, []);

  const value = React.useMemo(
    () => ({
      isHabitSheetOpen,
      editingHabit,
      initialTab,
      openAddHabit,
      openEditHabit,
      openHabitInsights,
      closeHabitSheet,
    }),
    [
      isHabitSheetOpen,
      editingHabit,
      initialTab,
      openAddHabit,
      openEditHabit,
      openHabitInsights,
      closeHabitSheet,
    ],
  );

  return (
    <HabitActionsContext.Provider value={value}>
      {children}
    </HabitActionsContext.Provider>
  );
}

// Fallback avoids crashes in isolated unit tests rendered without an outer provider.
const DEFAULT_HABIT_ACTIONS: HabitActionsContextValue = {
  isHabitSheetOpen: false,
  editingHabit: null,
  initialTab: "edit",
  openAddHabit: () => {},
  openEditHabit: () => {},
  openHabitInsights: () => {},
  closeHabitSheet: () => {},
};

export function useHabitActions() {
  const context = useContext(HabitActionsContext);
  return context ?? DEFAULT_HABIT_ACTIONS;
}
