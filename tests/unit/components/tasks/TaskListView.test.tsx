import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { VirtuosoMockContext } from "react-virtuoso";
import { TaskListView } from "@/components/tasks/TaskListView";
import type { Task, Project } from "@/lib/types/task";
import type { ProcessedTasks, TaskGroup } from "@/lib/hooks/useTaskViewData";

const droppableIds = new Set<string>();

vi.mock("@dnd-kit/core", () => ({
  useDroppable: ({ id }: { id: string }) => {
    droppableIds.add(id);
    return { setNodeRef: vi.fn() };
  },
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({
    id,
    items,
    children,
  }: {
    id?: string;
    items: string[];
    children: React.ReactNode;
  }) => (
    <div
      data-testid={`sortable-context-${id ?? "unnamed"}`}
      data-items-count={items.length}
    >
      {children}
    </div>
  ),
  verticalListSortingStrategy: {},
}));

const groupedVirtuosoPropsHistory: Record<string, unknown>[] = [];
vi.mock("react-virtuoso", async () => {
  const actual =
    await vi.importActual<typeof import("react-virtuoso")>("react-virtuoso");
  return {
    ...actual,
    GroupedVirtuoso: (props: Record<string, unknown>) => {
      groupedVirtuosoPropsHistory.push(props);
      const Grouped = actual.GroupedVirtuoso as React.ComponentType<
        Record<string, unknown>
      >;
      return <Grouped {...props} />;
    },
  };
});

vi.mock("@/components/tasks/SortableListTaskCard", () => ({
  default: ({
    task,
    onSelect,
    isKeyboardSelected,
  }: {
    task: Task;
    onSelect: (t: Task) => void;
    isKeyboardSelected?: boolean;
  }) => (
    <div
      data-testid={`task-card-${task.id}`}
      data-selected={isKeyboardSelected ? "true" : "false"}
      onClick={() => onSelect(task)}
    >
      {task.content}
    </div>
  ),
}));

vi.mock("@/components/tasks/TaskItem", () => ({
  TaskItem: ({
    task,
    onSelect,
  }: {
    task: Task;
    onSelect: (t: Task) => void;
  }) => (
    <div
      data-testid={`completed-task-${task.id}`}
      onClick={() => onSelect(task)}
    >
      {task.content}
    </div>
  ),
}));

const makeTask = (id: string, content: string): Task => ({
  id,
  user_id: "user-1",
  content,
  description: null,
  is_completed: false,
  completed_at: null,
  priority: 4,
  project_id: null,
  day_order: 0,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
  due_date: null,
  do_date: null,
  is_evening: false,
  parent_id: null,
  recurrence: null,
  recurring_series_id: null,
  google_event_id: null,
  google_etag: null,
});

describe("TaskListView", () => {
  const defaultProps = {
    processedTasks: {
      active: [makeTask("1", "Task 1")],
      evening: [],
      completed: [],
      groups: null,
    } as ProcessedTasks,
    activeTasks: [makeTask("1", "Task 1")],
    eveningTasks: [],
    groupTasks: null as TaskGroup[] | null,
    handleTaskClick: vi.fn(),
    keyboardSelectedId: null as string | null,
    isDndActive: false,
    projectsMap: new Map<string, Project>(),
    isDesktop: true,
    triggerHaptic: vi.fn(),
    setActiveTaskId: vi.fn(),
  };

  it("renders with pixel-perfect baseline alignment class first:mt-2 on sections", () => {
    const { container } = render(<TaskListView {...defaultProps} />);
    const activeSection = container.querySelector("section.first\\:mt-2");
    expect(activeSection).toBeInTheDocument();
  });

  it("invokes handleTaskClick when a task is selected", () => {
    const handleTaskClick = vi.fn();
    render(
      <TaskListView {...defaultProps} handleTaskClick={handleTaskClick} />,
    );

    fireEvent.click(screen.getByText("Task 1"));
    expect(handleTaskClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", content: "Task 1" }),
    );
  });

  it("marks the keyboard selected task appropriately", () => {
    render(<TaskListView {...defaultProps} keyboardSelectedId="1" />);
    const card = screen.getByTestId("task-card-1");
    expect(card).toHaveAttribute("data-selected", "true");
  });

  it("renders grouped sections when groupTasks are provided with first:mt-2 baseline", () => {
    const groupedProps = {
      ...defaultProps,
      groupTasks: [
        {
          title: "Today",
          tasks: [makeTask("2", "Grouped Task 2")],
        },
      ],
      processedTasks: {
        active: [],
        evening: [],
        completed: [],
        groups: [
          {
            title: "Today",
            tasks: [makeTask("2", "Grouped Task 2")],
          },
        ],
      } as ProcessedTasks,
    };

    const { container } = render(<TaskListView {...groupedProps} />);
    const section = container.querySelector("section.first\\:mt-2");
    expect(section).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Grouped Task 2")).toBeInTheDocument();
  });

  it("virtualizes grouped sections inside scrollParent with one outer SortableContext and droppable group headers", () => {
    droppableIds.clear();
    groupedVirtuosoPropsHistory.length = 0;
    const scrollParent = document.createElement("div");

    const inboxTasks = Array.from({ length: 30 }, (_, i) =>
      makeTask(`inbox-${i}`, `Inbox Task ${i}`),
    );
    const todayTasks = Array.from({ length: 25 }, (_, i) =>
      makeTask(`today-${i}`, `Today Task ${i}`),
    );
    const groups = [
      { title: "Inbox", tasks: inboxTasks },
      { title: "Today", tasks: todayTasks },
    ];
    const virtualizedProps = {
      ...defaultProps,
      groupTasks: groups,
      processedTasks: {
        active: [],
        evening: [],
        completed: [],
        groups,
      } as ProcessedTasks,
      scrollParent,
    };

    render(
      <VirtuosoMockContext.Provider
        value={{ viewportHeight: 1000, itemHeight: 50 }}
      >
        <TaskListView {...virtualizedProps} />
      </VirtuosoMockContext.Provider>,
    );
    // With GroupedVirtuoso, sticky opaque section headers render
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Inbox Task 1")).toBeInTheDocument();

    // Must scroll via TaskList's scroll container, never window
    const lastGroupedProps = groupedVirtuosoPropsHistory.at(-1);
    expect(lastGroupedProps?.useWindowScroll).toBeFalsy();
    expect(lastGroupedProps?.customScrollParent).toBe(scrollParent);

    // Must wrap the virtualized list in one outer SortableContext, not per-item duplicates
    const outerContexts = screen.getAllByTestId(
      "sortable-context-grouped-tasks",
    );
    expect(outerContexts).toHaveLength(1);
    expect(outerContexts[0]).toHaveAttribute("data-items-count", "55");
    expect(screen.queryByTestId("sortable-context-Inbox")).toBeNull();

    // Group headers must register DroppableContainer targets for cross-group drops
    expect(droppableIds.has("Inbox")).toBe(true);
  });
});
