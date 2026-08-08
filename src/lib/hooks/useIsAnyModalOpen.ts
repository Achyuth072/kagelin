import { useTaskActions } from "@/components/TaskActionsProvider";
import { useHabitActions } from "@/components/habits/HabitActionsProvider";
import { useProjectActions } from "@/components/ProjectActionsProvider";
import { useUiStore } from "@/lib/store/uiStore";
import { useCalendarStore } from "@/lib/calendar/store";

// Shared by GlobalHotkeys and TaskList so hotkeys agree on what counts as
// "a modal is open" — state-derived, not a DOM probe, so it's correct on the
// same render the modal opens. Command menu is excluded: it's AppShell-local
// state whose own input already filters keystrokes via enableOnFormTags: false.
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

  return (
    isAddTaskOpen ||
    isHabitSheetOpen ||
    isCreateProjectOpen ||
    isCreateEventOpen ||
    isShortcutsHelpOpen ||
    isArchivedProjectsOpen ||
    isChangelogOpen
  );
}
