import { useUiStore } from "@/lib/store/uiStore";
import { useIsTasksPage } from "./useIsTasksPage";

// Shared by GlobalHotkeys and ShortcutsHelp: board view claims `h` for
// horizontal navigation, so New Habit doesn't bind (or list) there. See
// .scratch/vim-keyboard-navigation/issues/01-board-view-2d-navigation.md.
export function useIsBoardViewOnTasks(): boolean {
  const viewMode = useUiStore((state) => state.viewMode);
  const isTasksPage = useIsTasksPage();
  return isTasksPage && viewMode === "board";
}
