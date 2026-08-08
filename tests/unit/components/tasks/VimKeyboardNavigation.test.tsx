import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { BoardTaskCard } from "@/components/tasks/BoardTaskCard";
import { ListTaskCard } from "@/components/tasks/ListTaskCard";
import type { ProcessedTasks } from "@/lib/hooks/useTaskViewData";
import type { Task } from "@/lib/types/task";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => ({
    data: [],
    isLoading: false,
  }),
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

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useReorderTasks: () => ({ mutate: vi.fn() }),
  useUpdateTask: () => ({ mutate: vi.fn() }),
  useDeleteTask: () => ({ mutate: vi.fn() }),
  useToggleTask: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-js-loaded", () => ({
  useJsLoaded: () => true,
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      viewMode: "board",
      isDesktop: true,
      selectedTaskId: null,
      setSelectedTaskId: vi.fn(),
      sortBy: "custom",
      setSortBy: vi.fn(),
      customSortEnteredViaDrag: false,
      setCustomSortEnteredViaDrag: vi.fn(),
      isShortcutsHelpOpen: false,
      isArchivedProjectsOpen: false,
      isChangelogOpen: false,
    }),
}));

describe("Vim Keyboard Navigation & Highlighting", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("applies inset ring highlight to BoardTaskCard when isKeyboardSelected is true", () => {
    const mockTask: Task = {
      id: "t1",
      content: "Board Task Highlight",
      priority: 4,
      is_completed: false,
      user_id: "u1",
      project_id: null,
      parent_id: null,
      description: null,
      due_date: null,
      do_date: null,
      is_evening: false,
      day_order: 0,
      recurrence: null,
      recurring_series_id: null,
      google_event_id: null,
      google_etag: null,
      completed_at: null,
      created_at: "",
      updated_at: "",
    };

    const { container } = render(
      <BoardTaskCard
        task={mockTask}
        project={undefined}
        handleComplete={vi.fn()}
        handlePlayFocus={vi.fn()}
        isKeyboardSelected={true}
      />,
    );

    const cardRoot = container.firstElementChild;
    expect(cardRoot?.className).toContain("ring-2");
    expect(cardRoot?.className).toContain("ring-primary");
    expect(cardRoot?.className).toContain("bg-secondary/40");
  });

  it("applies inset ring highlight to ListTaskCard when isKeyboardSelected is true", () => {
    const mockTask: Task = {
      id: "t1",
      content: "List Task Highlight",
      priority: 4,
      is_completed: false,
      user_id: "u1",
      project_id: null,
      parent_id: null,
      description: null,
      due_date: null,
      do_date: null,
      is_evening: false,
      day_order: 0,
      recurrence: null,
      recurring_series_id: null,
      google_event_id: null,
      google_etag: null,
      completed_at: null,
      created_at: "",
      updated_at: "",
    };

    const { container } = render(
      <ListTaskCard
        task={mockTask}
        isDesktop={true}
        isExpanded={false}
        toggleExpand={vi.fn()}
        handleComplete={vi.fn()}
        handlePlayFocus={vi.fn()}
        onDeleteRequest={vi.fn()}
        project={undefined}
        isKeyboardSelected={true}
      />,
    );

    const cardRoot = container.firstElementChild;
    expect(cardRoot?.className).toContain("ring-2");
    expect(cardRoot?.className).toContain("ring-primary");
    expect(cardRoot?.className).toContain("ring-inset");
    expect(cardRoot?.className).toContain("bg-secondary/40");
  });

  it("passes keyboardSelectedId down to BoardTaskCard in TaskBoard", () => {
    const processedTasks: ProcessedTasks = {
      active: [
        {
          id: "t1",
          content: "Active 1",
          priority: 4,
          is_completed: false,
          user_id: "u1",
          project_id: null,
          parent_id: null,
          description: null,
          due_date: null,
          do_date: null,
          is_evening: false,
          day_order: 0,
          recurrence: null,
          recurring_series_id: null,
          google_event_id: null,
          google_etag: null,
          completed_at: null,
          created_at: "",
          updated_at: "",
        },
      ],
      evening: [],
      completed: [],
      groups: null,
    };

    render(
      <TaskBoard
        processedTasks={processedTasks}
        projectsMap={new Map()}
        isDesktop={true}
        triggerHaptic={vi.fn()}
        setActiveTaskId={vi.fn()}
        keyboardSelectedId="t1"
      />,
    );

    const cardText = screen.getByText("Active 1");
    const boardCard = cardText.closest(".group\\/card");
    expect(boardCard?.className).toContain("ring-2");
    expect(boardCard?.className).toContain("ring-primary");
  });
});
