"use client";

import React, { createContext, useContext } from "react";
import type {
  UseTaskEditorOptions,
  TaskEditorState,
} from "@/lib/types/task-view";
import { useTaskEditor } from "./useTaskEditor";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";

export const TaskEditorContext = createContext<TaskEditorState | null>(null);

export function useTaskEditorContext(): TaskEditorState {
  const context = useContext(TaskEditorContext);
  if (!context) {
    throw new Error(
      "useTaskEditorContext must be used within a TaskEditorProvider",
    );
  }
  return context;
}

export interface TaskEditorProviderProps extends UseTaskEditorOptions {
  children: React.ReactNode;
}

export function TaskEditorProvider({
  children,
  ...options
}: TaskEditorProviderProps) {
  const editor = useTaskEditor(options);

  return (
    <TaskEditorContext.Provider value={editor}>
      {children}
      <DeleteConfirmationDialog
        isOpen={editor.showDeleteDialog}
        onClose={() => editor.setShowDeleteDialog(false)}
        onConfirm={editor.onConfirmDelete}
        title={editor.deleteTitle}
        description={editor.deleteDescription}
      />
    </TaskEditorContext.Provider>
  );
}
