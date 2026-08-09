/**
 * Regression test for the "p" collision between GlobalHotkeys' New Project
 * and TaskList's vim paste: New Project must only step aside while the
 * tasks page is actually mounted, and never linger past a route change —
 * unlike a bare `yankedTask` store check, which stayed suppressed app-wide
 * until a hard reload.
 */

import { render, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GlobalHotkeys } from "@/components/layout/GlobalHotkeys";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task } from "@/lib/types/task";

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

const makeTask = (): Task => ({
  id: "task-1",
  user_id: "guest",
  content: "Yanked",
  description: null,
  is_completed: false,
  completed_at: null,
  priority: 4,
  project_id: null,
  day_order: 0,
  created_at: "2026-05-06T00:00:00.000Z",
  updated_at: "2026-05-06T00:00:00.000Z",
  due_date: null,
  do_date: null,
  is_evening: false,
  parent_id: null,
  recurrence: null,
  recurring_series_id: null,
  google_event_id: null,
  google_etag: null,
});

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
      yankedTask: null,
      isShortcutsHelpOpen: false,
      isArchivedProjectsOpen: false,
      isChangelogOpen: false,
    });
  });

  it("suppresses New Project on the tasks page while a task is yanked", async () => {
    await renderGlobalHotkeys("/");
    act(() => {
      useUiStore.setState({ yankedTask: makeTask() });
    });

    fireEvent.keyDown(document, { key: "p", code: "KeyP" });

    expect(openCreateProject).not.toHaveBeenCalled();
  });

  it("still opens New Project elsewhere in the app even with a stale yanked task", async () => {
    await renderGlobalHotkeys("/habits");
    act(() => {
      useUiStore.setState({ yankedTask: makeTask() });
    });

    fireEvent.keyDown(document, { key: "p", code: "KeyP" });

    expect(openCreateProject).toHaveBeenCalledTimes(1);
  });

  it("opens New Project on the tasks page once nothing is yanked", async () => {
    await renderGlobalHotkeys("/");
    // yankedTask stays null (set in beforeEach)

    fireEvent.keyDown(document, { key: "p", code: "KeyP" });

    expect(openCreateProject).toHaveBeenCalledTimes(1);
  });
});
