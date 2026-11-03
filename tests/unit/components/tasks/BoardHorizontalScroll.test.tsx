import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { TaskGroup, ProcessedTasks } from "@/lib/hooks/useTaskViewData";

vi.mock("@/lib/hooks/use-js-loaded", () => ({
  useJsLoaded: () => true,
}));

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useUpdateTask: vi.fn(),
  useToggleTask: vi.fn(),
  useReorderTasks: vi.fn(),
  useDeleteTask: vi.fn(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@dnd-kit/core", async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>("@dnd-kit/core");
  return {
    ...actual,
    useDroppable: () => ({ setNodeRef: vi.fn() }),
  };
});

describe("Board Horizontal Scrolling Feedback Loop", () => {
  const makeGroup = (title: string, count: number): TaskGroup => ({
    title,
    tasks: Array.from({ length: count }, (_, i) => ({
      id: `${title}-${i}`,
      user_id: "u1",
      content: `${title} Task ${i}`,
      description: null,
      is_completed: false,
      completed_at: null,
      priority: 4,
      project_id: null,
      day_order: i,
      created_at: "",
      updated_at: "",
      due_date: null,
      do_date: null,
      is_evening: false,
      parent_id: null,
      recurrence: null,
      recurring_series_id: null,
      google_event_id: null,
      google_etag: null,
    })),
  });

  const mockGroups: TaskGroup[] = [
    makeGroup("Column 1", 2),
    makeGroup("Column 2", 2),
    makeGroup("Column 3", 2),
    makeGroup("Column 4", 2),
  ];

  const mockPresentation: ProcessedTasks = {
    active: [],
    evening: [],
    completed: [],
    groups: mockGroups,
  };

  it("scrolls horizontally when receiving vertical wheel events on the board container", () => {
    render(
      <TooltipProvider>
        <TaskBoard
          presentation={mockPresentation}
          projectsMap={new Map()}
          isDesktop={true}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
        />
      </TooltipProvider>,
    );

    const board = screen.getByTestId("task-board-container");
    expect(board).toBeInTheDocument();

    board.scrollLeft = 0;
    // Simulate vertical mouse wheel down (e.g. deltaY = 120)
    fireEvent.wheel(board, { deltaY: 120, deltaX: 0 });

    // Expect the board to have scrolled horizontally
    expect(board.scrollLeft).toBeGreaterThan(0);
  });

  it("does not hijack vertical wheel event if target is a column with vertical scroll headroom", () => {
    render(
      <TooltipProvider>
        <TaskBoard
          presentation={mockPresentation}
          projectsMap={new Map()}
          isDesktop={true}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
        />
      </TooltipProvider>,
    );

    const board = screen.getByTestId("task-board-container");
    const columnScrollArea = screen.getAllByRole("row")[0];
    expect(columnScrollArea).toBeInTheDocument();

    // Mock vertical headroom in this column
    Object.defineProperty(columnScrollArea, "scrollTop", {
      value: 0,
      writable: true,
    });
    Object.defineProperty(columnScrollArea, "scrollHeight", {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(columnScrollArea, "clientHeight", {
      value: 300,
      configurable: true,
    });

    board.scrollLeft = 0;
    fireEvent.wheel(columnScrollArea, { deltaY: 50, deltaX: 0 });

    // Should NOT scroll board horizontally because column has vertical room
    expect(board.scrollLeft).toBe(0);
  });

  it("does not hijack native horizontal scroll events (Shift or deltaX)", () => {
    render(
      <TooltipProvider>
        <TaskBoard
          presentation={mockPresentation}
          projectsMap={new Map()}
          isDesktop={true}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
        />
      </TooltipProvider>,
    );

    const board = screen.getByTestId("task-board-container");
    board.scrollLeft = 0;

    // Shift key down with deltaY
    fireEvent.wheel(board, { deltaY: 100, deltaX: 0, shiftKey: true });
    expect(board.scrollLeft).toBe(0);

    // Predominantly horizontal deltaX (trackpad swipe)
    fireEvent.wheel(board, { deltaY: 10, deltaX: 80 });
    expect(board.scrollLeft).toBe(0);
  });

  it("forwards onScroll callback when container scrolls", () => {
    const onScrollMock = vi.fn();
    render(
      <TooltipProvider>
        <TaskBoard
          presentation={mockPresentation}
          projectsMap={new Map()}
          isDesktop={true}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
          onScroll={onScrollMock}
        />
      </TooltipProvider>,
    );

    const board = screen.getByTestId("task-board-container");
    fireEvent.scroll(board);
    expect(onScrollMock).toHaveBeenCalledTimes(1);
  });

  it("carries data-task-list-scroll-container so dnd-kit can auto-scroll the board horizontally", () => {
    render(
      <TooltipProvider>
        <TaskBoard
          presentation={mockPresentation}
          projectsMap={new Map()}
          isDesktop={true}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
        />
      </TooltipProvider>,
    );

    const board = screen.getByTestId("task-board-container");
    expect(board.dataset.taskListScrollContainer).toBe("true");

    const columnRows = screen.getAllByRole("row");
    expect(columnRows[0].dataset.taskListScrollContainer).toBe("true");
  });

  it("does not suppress the desktop scrollbar with scrollbar-hide on desktop", () => {
    render(
      <TooltipProvider>
        <TaskBoard
          presentation={mockPresentation}
          projectsMap={new Map()}
          isDesktop={true}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
        />
      </TooltipProvider>,
    );

    const board = screen.getByTestId("task-board-container");
    expect(board.className).not.toMatch(/\bscrollbar-hide\b/);
    expect(board.className).toContain("custom-scrollbar");
  });

  it("uses scrollbar-hide on mobile", () => {
    render(
      <TooltipProvider>
        <TaskBoard
          presentation={mockPresentation}
          projectsMap={new Map()}
          isDesktop={false}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
        />
      </TooltipProvider>,
    );

    const board = screen.getByTestId("task-board-container");
    expect(board.className).toContain("scrollbar-hide");
    expect(board.className).not.toContain("custom-scrollbar");
  });
});
