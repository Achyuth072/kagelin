import { create } from "zustand";
import type { TaskFormValues } from "@/lib/types/task-view";

// Ephemeral, session-only snapshots of unsaved task-editor form values, keyed
// by task id. Written when a task editor for that task unmounts with live
// values; popped once by the next editor mount for the same task. This bridges
// the docked pane → modal sheet transition when the viewport crosses 1280px
// (spec story 20), without persisting anything. Drafts for tasks never re-opened
// are simply forgotten when the tab closes.
interface TaskEditorDraftsState {
  drafts: Record<string, TaskFormValues>;
  saveDraft: (taskId: string, values: TaskFormValues) => void;
  popDraft: (taskId: string) => TaskFormValues | undefined;
}

export const useTaskEditorDrafts = create<TaskEditorDraftsState>(
  (set, get) => ({
    drafts: {},
    saveDraft: (taskId, values) =>
      set((state) => ({ drafts: { ...state.drafts, [taskId]: values } })),
    popDraft: (taskId) => {
      const values = get().drafts[taskId];
      if (values) {
        set((state) => {
          if (!(taskId in state.drafts)) return state;
          const drafts = { ...state.drafts };
          delete drafts[taskId];
          return { drafts };
        });
      }
      return values;
    },
  }),
);
