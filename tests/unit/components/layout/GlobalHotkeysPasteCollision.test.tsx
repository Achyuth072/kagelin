/**
 * Regression test for the "p" collision between GlobalHotkeys' New Project
 * and TaskList's vim paste: New Project must only step aside while the
 * tasks page is actually mounted, and never linger past a route change —
 * unlike a bare `yankedTaskId` store check, which stayed suppressed app-wide
 * until a hard reload.
 */

import { render, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GlobalHotkeys } from "@/components/layout/GlobalHotkeys";
import { useUiStore } from "@/lib/store/uiStore";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), resolvedTheme: "light" }),
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn(), isAddTaskOpen: false }),
}));
vi.mock("@/components/CompletedTasksProvider", () => ({
  useCompletedTasks: () => ({ openSheet: vi.fn() }),
}));
vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({ openAddHabit: vi.fn(), isHabitSheetOpen: false }),
}));
const openCreateProject = vi.fn();
vi.mock("@/components/ProjectActionsProvider", () => ({
  useProjectActions: () => ({
    openCreateProject,
    isCreateProjectOpen: false,
  }),
}));
vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: () => ({
    openCreateEvent: vi.fn(),
    isCreateEventOpen: false,
  }),
}));

async function renderGlobalHotkeys(pathname: string) {
  const { usePathname } = await import("next/navigation");
  vi.mocked(usePathname).mockReturnValue(pathname);
  return render(
    <GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={vi.fn()} />,
  );
}

describe("GlobalHotkeys — New Project vs. paste 'p' collision", () => {
  beforeEach(() => {
    openCreateProject.mockClear();
    useUiStore.setState({
      viewMode: "list",
      yankedTaskId: null,
      isShortcutsHelpOpen: false,
      isArchivedProjectsOpen: false,
      isChangelogOpen: false,
    });
  });

  it("suppresses New Project on the tasks page while a task is yanked", async () => {
    await renderGlobalHotkeys("/");
    act(() => {
      useUiStore.setState({ yankedTaskId: "task-1" });
    });

    fireEvent.keyDown(document, { key: "p", code: "KeyP" });

    expect(openCreateProject).not.toHaveBeenCalled();
  });

  it("still opens New Project elsewhere in the app even with a stale yanked task", async () => {
    await renderGlobalHotkeys("/habits");
    act(() => {
      useUiStore.setState({ yankedTaskId: "task-1" });
    });

    fireEvent.keyDown(document, { key: "p", code: "KeyP" });

    expect(openCreateProject).toHaveBeenCalledTimes(1);
  });

  it("opens New Project on the tasks page once nothing is yanked", async () => {
    await renderGlobalHotkeys("/");
    // yankedTaskId stays null (set in beforeEach)

    fireEvent.keyDown(document, { key: "p", code: "KeyP" });

    expect(openCreateProject).toHaveBeenCalledTimes(1);
  });

  it("opens New Project again once the yanked task is released (e.g. via Escape in TaskList)", async () => {
    await renderGlobalHotkeys("/");
    act(() => {
      useUiStore.setState({ yankedTaskId: "task-1" });
    });
    fireEvent.keyDown(document, { key: "p", code: "KeyP" });
    expect(openCreateProject).not.toHaveBeenCalled();

    act(() => {
      useUiStore.setState({ yankedTaskId: null });
    });
    fireEvent.keyDown(document, { key: "p", code: "KeyP" });

    expect(openCreateProject).toHaveBeenCalledTimes(1);
  });
});
