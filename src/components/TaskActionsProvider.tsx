"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { useShortcutTips } from "@/lib/hooks/useShortcutTips";

export interface OpenTaskOptions {
  source?: "mouse" | "keyboard";
}

interface TaskActionsContextValue {
  isAddTaskOpen: boolean;
  openAddTask: (options?: OpenTaskOptions) => void;
  closeAddTask: () => void;
}

const TaskActionsContext = createContext<TaskActionsContextValue | null>(null);

export function TaskActionsProvider({ children }: { children: ReactNode }) {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const { recordMouseAction } = useShortcutTips();

  const openAddTask = React.useCallback(
    (options?: OpenTaskOptions) => {
      if (options?.source !== "keyboard") {
        recordMouseAction("newTask");
      }
      setIsAddTaskOpen(true);
    },
    [recordMouseAction],
  );
  const closeAddTask = React.useCallback(() => setIsAddTaskOpen(false), []);

  const value = React.useMemo(
    () => ({
      isAddTaskOpen,
      openAddTask,
      closeAddTask,
    }),
    [isAddTaskOpen, openAddTask, closeAddTask],
  );

  return (
    <TaskActionsContext.Provider value={value}>
      {children}
    </TaskActionsContext.Provider>
  );
}

// Fallback avoids crashes in isolated unit tests rendered without an outer provider.
const DEFAULT_TASK_ACTIONS: TaskActionsContextValue = {
  isAddTaskOpen: false,
  openAddTask: () => {},
  closeAddTask: () => {},
};

export function useTaskActions() {
  const context = useContext(TaskActionsContext);
  return context ?? DEFAULT_TASK_ACTIONS;
}
