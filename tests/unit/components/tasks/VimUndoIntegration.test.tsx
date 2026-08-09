/**
 * Component-level integration test for the spec's own undo scenario
 * (.planning/78-vim-controls-expansion-spec.md Testing Decisions): "Mount
 * TaskList and trigger a delete via `d`, then press `u` and assert the
 * deletion is undone." Unlike VimKeyboardNavigation.test.tsx (which mocks
 * useDeleteTask and the undo registry directly), this exercises the real
 * useDeleteTask hook against the real mockStore, so a regression in
 * useDeleteTask's onSuccess failing to register its undo closure would
 * actually be caught here.
 */

import { render, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import { useUiStore } from "@/lib/store/uiStore";
import { mockStore } from "@/lib/mock/mock-store";

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

// useTasks and useDeleteTask are deliberately left unmocked — this test
// exercises the real query + mutation stack against the real mockStore, so
// useDeleteTask's onSuccess actually has to register the undo closure.

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

describe("d then u round trip (real mutation, guest mode)", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.clearData();
    useUiStore.setState({
      viewMode: "list",
      isDesktop: true,
      selectedTaskId: null,
      lastUndoAction: null,
    });
  });

  it("restores a task deleted via 'd' when 'u' is pressed", async () => {
    const task = mockStore.addTask({ content: "Buy groceries" });
    await renderTaskList();

    fireEvent.keyDown(document, { key: "j", code: "KeyJ" });
    fireEvent.keyDown(document, { key: "d", code: "KeyD" });

    await waitFor(() => {
      expect(mockStore.getTask(task.id)).toBeNull();
    });
    // useDeleteTask's onSuccess registers the undo closure asynchronously.
    await waitFor(() => {
      expect(useUiStore.getState().lastUndoAction).not.toBeNull();
    });

    fireEvent.keyDown(document, { key: "u", code: "KeyU" });

    await waitFor(() => {
      const restored = mockStore.getTask(task.id);
      expect(restored).not.toBeNull();
      expect(restored?.content).toBe("Buy groceries");
    });
  });
});
