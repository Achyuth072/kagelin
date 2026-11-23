import { useTaskActions } from "@/components/TaskActionsProvider";
import { useHabitActions } from "@/components/habits/HabitActionsProvider";
import { useProjectActions } from "@/components/ProjectActionsProvider";
import { useUiStore } from "@/lib/store/uiStore";
import { useCalendarStore } from "@/lib/calendar/store";

// State-derived modal check so hotkeys and DnD disable on the initial render a dialog opens.
export function useIsAnyModalOpen(): boolean {
  const { isAddTaskOpen } = useTaskActions();
  const { isHabitSheetOpen } = useHabitActions();
  const { isCreateProjectOpen } = useProjectActions();
  const { isCreateEventOpen } = useCalendarStore();
  const isShortcutsHelpOpen = useUiStore((state) => state.isShortcutsHelpOpen);
  const isArchivedProjectsOpen = useUiStore(
    (state) => state.isArchivedProjectsOpen,
  );
  const isChangelogOpen = useUiStore((state) => state.isChangelogOpen);
  const activeDialogCount = useUiStore((state) => state?.activeDialogCount);

  return (
    Boolean(isAddTaskOpen) ||
    Boolean(isHabitSheetOpen) ||
    Boolean(isCreateProjectOpen) ||
    Boolean(isCreateEventOpen) ||
    Boolean(isShortcutsHelpOpen) ||
    Boolean(isArchivedProjectsOpen) ||
    Boolean(isChangelogOpen) ||
    (activeDialogCount ?? 0) > 0
  );
}
