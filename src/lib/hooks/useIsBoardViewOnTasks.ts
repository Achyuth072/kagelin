import { usePathname } from "next/navigation";
import { useUiStore } from "@/lib/store/uiStore";

// Shared by GlobalHotkeys and ShortcutsHelp: board view claims `h` for
// horizontal navigation, so New Habit doesn't bind (or list) there. See
// .scratch/vim-keyboard-navigation/issues/01-board-view-2d-navigation.md.
export function useIsBoardViewOnTasks(): boolean {
  const pathname = usePathname();
  const viewMode = useUiStore((state) => state.viewMode);
  const isTasksPage = pathname === "/" || pathname?.startsWith("/tasks");
  return isTasksPage && viewMode === "board";
}
