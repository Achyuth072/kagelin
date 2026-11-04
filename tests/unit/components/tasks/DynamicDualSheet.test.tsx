import type { ReactNode } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import { taskDomId } from "@/components/tasks/task-utils";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task } from "@/lib/types/task";

const storeState = vi.hoisted(() => ({ tasks: [] as Task[] }));

vi.mock("@/lib/mock/mock-store", () => ({
  mockStore: {
    getTasks: () => storeState.tasks,
    getProjects: () => [],
    updateTask: (id: string, updates: Partial<Task>) => {
      storeState.tasks = storeState.tasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      );
      return storeState.tasks.find((t) => t.id === id) ?? null;
    },
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/tasks/TaskGhost", () => ({
  TaskGhost: () => <div data-testid="task-ghost" />,
}));

vi.mock("@/components/tasks/TaskSheet", () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" data-testid="task-sheet-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
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

const mockHapticTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: mockHapticTrigger }),
}));

let mockIsWide = true;
vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: (query: string) => {
    if (query.includes("1280")) return mockIsWide;
    return true;
  },
}));

vi.mock("@dnd-kit/core", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children }: { children: ReactNode }) => (
      <div data-testid="dnd-context">{children}</div>
    ),
    DragOverlay: ({ children }: { children: ReactNode }) => (
      <div data-testid="drag-overlay">{children}</div>
    ),
    useDroppable: () => ({ setNodeRef: vi.fn() }),
    useSensor: vi.fn((sensor, options) => ({ sensor, options })),
    useSensors: vi.fn((...sensors) => sensors),
  };
});
vi.mock("@dnd-kit/sortable", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/sortable")>(
      "@dnd-kit/sortable",
    );
  return {
    ...actual,
    SortableContext: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    sortableKeyboardCoordinates: vi.fn(),
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      setActivatorNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
      isOver: false,
      active: null,
      over: null,
    }),
  };
});

const makeTask = (id: string, content: string, dayOrder: number): Task => ({
  id,
  user_id: "guest",
  content,
  description: null,
  is_completed: false,
  completed_at: null,
  priority: 4,
  project_id: null,
  day_order: dayOrder,
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

describe("DynamicDualSheet in TaskList", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockIsWide = true;
    useUiStore.setState({
      viewMode: "list",
      sortBy: "date",
      groupBy: "none",
      boardInspectMode: "overlay",
    });
    storeState.tasks = [
      makeTask("task-1", "Alpha task", 1),
      makeTask("task-2", "Beta task", 2),
    ];
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    queryClient.setQueryData(
      ["tasks", { projectId: undefined, filter: undefined }],
      storeState.tasks,
    );
  });

  const renderTaskList = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <TaskList />
      </QueryClientProvider>,
    );

  it("DDS-01: Renders task list at 100% width by default with collapsed inspector", async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getByText("Alpha task")).toBeInTheDocument();
    });

    const scrollContainer = screen.getByRole("listbox");
    expect(scrollContainer).toHaveClass("w-full");
    const inspector = screen.getByTestId("docked-task-inspector");
    expect(inspector).toHaveClass("w-0");
    expect(inspector).toHaveClass("opacity-0");
    expect(
      screen.queryByTestId("board-overlay-drawer"),
    ).not.toBeInTheDocument();
  });

  it("DDS-02: Expands side inspector (w-[40%], duration-200, pt-2) and shrinks list to w-[60%] on desktop selection", async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getByText("Alpha task")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Alpha task"));

    await waitFor(() => {
      const inspector = screen.getByTestId("docked-task-inspector");
      expect(inspector).toHaveClass("w-[40%]");
      expect(inspector).toHaveClass("opacity-100");
    });

    const inspector = screen.getByTestId("docked-task-inspector");
    expect(inspector).toHaveClass("pt-2");
    expect(inspector).toHaveClass("duration-200");

    const scrollContainer = screen.getByRole("listbox");
    expect(scrollContainer).toHaveClass("w-[60%]");
  });

  it("DDS-03: Returns to 100% width when detail panel close button is clicked", async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getAllByText("Alpha task")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Alpha task")[0]);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /close task details/i }),
      ).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole("button", {
      name: /close task details/i,
    });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      const scrollContainer = screen.getByRole("listbox");
      expect(scrollContainer).toHaveClass("w-full");
      const inspector = screen.getByTestId("docked-task-inspector");
      expect(inspector).toHaveClass("w-0");
    });
    expect(mockHapticTrigger).toHaveBeenCalledWith("tick");
  });

  it("DDS-04: Follows cache edits to the selected task in place", async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getAllByText("Alpha task")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Alpha task")[0]);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Alpha task")).toBeInTheDocument();
    });

    act(() => {
      storeState.tasks = storeState.tasks.map((t) =>
        t.id === "task-1" ? { ...t, content: "Alpha task edited" } : t,
      );
      queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
        old?.map((t) =>
          t.id === "task-1" ? { ...t, content: "Alpha task edited" } : t,
        ),
      );
    });

    expect(
      await screen.findByDisplayValue("Alpha task edited"),
    ).toBeInTheDocument();
  });

  it("DDS-05: Routes viewports <1280px through modal TaskSheet and >=1280px to docked pane", async () => {
    mockIsWide = false;
    renderTaskList();

    await waitFor(() => {
      expect(screen.getAllByText("Alpha task")[0]).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId("docked-task-inspector"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Alpha task")[0]);

    // Modal TaskSheet should render
    expect(await screen.findByTestId("task-sheet-modal")).toBeInTheDocument();
    expect(
      screen.queryByTestId("docked-task-inspector"),
    ).not.toBeInTheDocument();
  });

  it("DDS-06: Pointerdown click outside dismisses docked inspector", async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getAllByText("Alpha task")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Alpha task")[0]);
    await waitFor(() => {
      const inspector = screen.getByTestId("docked-task-inspector");
      expect(inspector).toHaveClass("w-[40%]");
    });

    // Click outside on body/canvas
    act(() => {
      fireEvent.pointerDown(document.body, { button: 0 });
    });

    await waitFor(() => {
      const scrollContainer = screen.getByRole("listbox");
      expect(scrollContainer).toHaveClass("w-full");
      const inspector = screen.getByTestId("docked-task-inspector");
      expect(inspector).toHaveClass("w-0");
    });
  });

  it("DDS-07: Pointerdown inside inspector does not dismiss it", async () => {
    renderTaskList();

    await waitFor(() => {
      expect(screen.getAllByText("Alpha task")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Alpha task")[0]);
    const inspector = await screen.findByTestId("docked-task-inspector");

    act(() => {
      fireEvent.pointerDown(inspector, { button: 0 });
    });

    expect(inspector).toHaveClass("w-[40%]");
  });
});

describe("TaskList deep-link hydration (?task=)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockIsWide = true;
    useUiStore.setState({
      viewMode: "list",
      sortBy: "date",
      groupBy: "none",
      boardInspectMode: "overlay",
    });
    storeState.tasks = [
      makeTask("task-1", "Alpha task", 1),
      makeTask("task-2", "Beta task", 2),
    ];
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    queryClient.setQueryData(
      ["tasks", { projectId: undefined, filter: undefined }],
      storeState.tasks,
    );
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  const renderTaskList = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <TaskList />
      </QueryClientProvider>,
    );

  it("opens the modal sheet for a cold ?task= deep link below 1280px (story 21)", async () => {
    mockIsWide = false;
    window.history.pushState({}, "", "/?task=task-2");

    renderTaskList();

    await waitFor(() => {
      expect(screen.getByTestId("task-sheet-modal")).toBeInTheDocument();
    });
  });

  it("opens the docked inspector for a cold ?task= deep link on desktop (story 21)", async () => {
    mockIsWide = true;
    window.history.pushState({}, "", "/?task=task-1");

    renderTaskList();

    await waitFor(() => {
      const inspector = screen.getByTestId("docked-task-inspector");
      expect(inspector).toHaveClass("w-[40%]");
      expect(inspector).toHaveClass("opacity-100");
    });

    // Deep links must not mark the task as Vim-selected.
    expect(document.getElementById(taskDomId("task-1"))).not.toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
