/**
 * Component-level integration test for the yy/p duplication *semantics* the
 * spec calls out explicitly (.planning/78-vim-controls-expansion-spec.md
 * Testing Decisions): "Press yy on a recurring occurrence, then p. Assert
 * that the new task has no series_id and that its subtasks were
 * duplicated." Unlike VimYankPaste.test.tsx (which mocks useTaskMutations
 * wholesale to test wiring), this exercises the real useDuplicateTask hook
 * against the real mockStore, so the actual stripping/cloning logic in
 * taskMutations.duplicate runs end-to-end from a keypress.
 */

import { render, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import { useUiStore } from "@/lib/store/uiStore";
import { mockStore } from "@/lib/mock/mock-store";
import type { Task } from "@/lib/types/task";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: true }),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: () => ({ data: [] }),
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn(), isAddTaskOpen: false }),
}));

vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({ openAddHabit: vi.fn(), isHabitSheetOpen: false }),
}));

vi.mock("@/components/ProjectActionsProvider", () => ({
  useProjectActions: () => ({
    openCreateProject: vi.fn(),
    isCreateProjectOpen: false,
  }),
}));

vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: () => ({
    openCreateEvent: vi.fn(),
    isCreateEventOpen: false,
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/notify", () => ({
  notify: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("@/components/tasks/TaskSheet", () => ({
  default: ({ open }: { open: boolean }) => (
    <div data-testid="task-sheet">{open ? "open" : "closed"}</div>
  ),
}));

// useTasks and useDuplicateTask are deliberately left unmocked — this test
// exercises the real query + mutation stack against the real mockStore, so
// taskMutations.duplicate's stripping/cloning logic actually runs.

async function renderTaskList() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const view = render(
    <QueryClientProvider client={qc}>
      <TaskList />
    </QueryClientProvider>,
  );
  await waitFor(() => {
    expect(document.querySelector('[role="listbox"]')).toBeTruthy();
  });
  return view;
}

describe("yy / p duplication semantics (real mutation, guest mode)", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.clearData();
    useUiStore.setState({
      viewMode: "list",
      isDesktop: true,
      selectedTaskId: null,
      yankedTaskId: null,
    });
  });

  it("pasting a yanked recurring occurrence strips its series and deep-copies subtasks", async () => {
    const occurrence = mockStore.addTask({
      content: "Weekly standup",
      recurrence: { freq: "WEEKLY", interval: 1 },
      recurring_series_id: "series-abc",
    });
    mockStore.addTask({ content: "Prep notes", parent_id: occurrence.id });
    mockStore.addTask({ content: "Send agenda", parent_id: occurrence.id });

    await renderTaskList();

    // Select the occurrence, yank it (yy), then paste (p).
    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
    fireEvent.keyDown(document, { key: "y", code: "KeyY" });
    fireEvent.keyDown(document, { key: "y", code: "KeyY" });
    fireEvent.keyDown(document, { key: "p", code: "KeyP" });

    await waitFor(() => {
      const allTasks = mockStore.getTasks();
      expect(allTasks.length).toBe(6); // 3 originals + 3 duplicates
    });

    const allTasks: Task[] = mockStore.getTasks();
    const duplicatedParent = allTasks.find(
      (t) => t.content === "Weekly standup" && t.id !== occurrence.id,
    );
    expect(duplicatedParent).toBeDefined();
    expect(duplicatedParent?.recurring_series_id).toBeNull();
    expect(duplicatedParent?.recurrence).toBeNull();

    const duplicatedSubtasks = allTasks.filter(
      (t) => t.parent_id === duplicatedParent?.id,
    );
    expect(duplicatedSubtasks.map((t) => t.content).sort()).toEqual(
      ["Prep notes", "Send agenda"].sort(),
    );
  });
});
