"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { Habit } from "@/lib/types/habit";
import type { SheetTab } from "@/components/ui/SheetTabToggle";

interface HabitActionsContextValue {
  isHabitSheetOpen: boolean;
  editingHabit: Habit | null;
  initialTab: SheetTab;
  openAddHabit: () => void;
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

  const openAddHabit = React.useCallback(() => {
    setEditingHabit(null);
    setInitialTab("edit");
    setIsHabitSheetOpen(true);
  }, []);

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

export function useHabitActions() {
  const context = useContext(HabitActionsContext);
  if (!context) {
    throw new Error(
      "useHabitActions must be used within a HabitActionsProvider",
    );
  }
  return context;
}
