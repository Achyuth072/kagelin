import type { ReactNode } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import TaskList from "@/components/tasks/TaskList";
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

describe("TaskBoard Overlay Drawer and Architecture Consolidation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockIsWide = true;
    useUiStore.setState({
      viewMode: "board",
      sortBy: "date",
      groupBy: "none",
      boardInspectMode: "overlay",
    });
    storeState.tasks = [
      makeTask("task-1", "Task Alpha", 1),
      makeTask("task-2", "Task Beta", 2),
    ];
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    queryClient.setQueryData(
      ["tasks", { projectId: undefined, filter: undefined }],
      storeState.tasks,
    );
  });

  const renderTaskBoard = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <TaskList />
      </QueryClientProvider>,
    );

  it("TB-01: In Board view on desktop, inspecting a card opens a floating 440px overlay drawer with zero background blur", async () => {
    renderTaskBoard();

    await waitFor(() => {
      expect(screen.getByText("Task Alpha")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Task Alpha"));

    await waitFor(() => {
      expect(screen.getByTestId("board-overlay-drawer")).toBeInTheDocument();
    });

    const drawer = screen.getByTestId("board-overlay-drawer");
    expect(drawer).toHaveClass("w-[440px]");
    expect(drawer).toHaveClass("z-30");
    expect(drawer).toHaveClass("absolute");
    expect(drawer).toHaveClass("right-0");
    // Zero background blur: ensure no backdrop-blur class
    expect(drawer.className).not.toMatch(/backdrop-blur/);

    // Background board container remains full width without horizontal compression
    const scrollContainer = screen.getByRole("grid");
    expect(scrollContainer).toHaveClass("w-full");
    expect(scrollContainer).not.toHaveClass("w-[60%]");
  });

  it("TB-02: Clicking another task card in the background immediately switches inspection without closing drawer", async () => {
    renderTaskBoard();

    await waitFor(() => {
      expect(screen.getAllByText("Task Alpha")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Task Beta")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Task Alpha")[0]);
    await waitFor(() => {
      expect(screen.getByTestId("board-overlay-drawer")).toBeInTheDocument();
    });

    // Both cards remain visible in the background columns
    const betaCard = screen.getAllByText("Task Beta")[0];
    fireEvent.click(betaCard);

    // Drawer stays open and switches in place to Task Beta
    await waitFor(() => {
      expect(screen.getByDisplayValue("Task Beta")).toBeInTheDocument();
      expect(screen.getByTestId("board-overlay-drawer")).toBeInTheDocument();
    });
  });

  it("TB-03: Global pointerdown dismisses inspector when clicking canvas voids or headers", async () => {
    renderTaskBoard();

    await waitFor(() => {
      expect(screen.getAllByText("Task Alpha")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Task Alpha")[0]);
    await waitFor(() => {
      const drawer = screen.getByTestId("board-overlay-drawer");
      expect(drawer).toHaveClass("translate-x-0");
    });

    // Click on canvas void (document.body)
    act(() => {
      fireEvent.pointerDown(document.body, { button: 0 });
    });

    await waitFor(() => {
      const drawer = screen.getByTestId("board-overlay-drawer");
      expect(drawer).toHaveClass("translate-x-full");
    });
  });

  it("TB-04: Portalled dialogs, menus, and inspector clicks do not trigger click-outside dismissal", async () => {
    renderTaskBoard();

    await waitFor(() => {
      expect(screen.getAllByText("Task Alpha")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Task Alpha")[0]);
    const drawer = await screen.findByTestId("board-overlay-drawer");

    // Click inside the drawer
    act(() => {
      fireEvent.pointerDown(drawer, { button: 0 });
    });
    expect(drawer).toHaveClass("translate-x-0");

    // Simulate clicking an element inside a portalled menu/dialog
    const portalledDialog = document.createElement("div");
    portalledDialog.setAttribute("role", "dialog");
    document.body.appendChild(portalledDialog);

    act(() => {
      fireEvent.pointerDown(portalledDialog, { button: 0 });
    });
    expect(drawer).toHaveClass("translate-x-0");

    document.body.removeChild(portalledDialog);
  });

  it("TB-05: Inspect mode toggle allows switching between overlay drawer and push split", async () => {
    renderTaskBoard();

    await waitFor(() => {
      expect(screen.getAllByText("Task Alpha")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Task Alpha")[0]);
    await waitFor(() => {
      expect(screen.getByTestId("board-overlay-drawer")).toBeInTheDocument();
    });

    // Find the toggle button in the inspector header
    const toggleBtn = screen.getByTestId("board-inspect-mode-toggle");
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-label", "Switch to split view");

    // Click toggle to switch to push-split
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(useUiStore.getState().boardInspectMode).toBe("split");
      // In split mode, the scrollContainer shrinks to w-[60%]
      const scrollContainer = screen.getByRole("grid");
      expect(scrollContainer).toHaveClass("w-[60%]");
      expect(screen.getByTestId("docked-task-inspector")).toBeInTheDocument();
      expect(
        screen.queryByTestId("board-overlay-drawer"),
      ).not.toBeInTheDocument();
    });

    // Toggle back to overlay drawer
    const toggleBtn2 = screen.getByTestId("board-inspect-mode-toggle");
    expect(toggleBtn2).toHaveAttribute(
      "aria-label",
      "Switch to overlay drawer",
    );
    fireEvent.click(toggleBtn2);

    await waitFor(() => {
      expect(useUiStore.getState().boardInspectMode).toBe("overlay");
      const scrollContainer = screen.getByRole("grid");
      expect(scrollContainer).toHaveClass("w-full");
      expect(screen.getByTestId("board-overlay-drawer")).toBeInTheDocument();
    });
  });

  it("TB-06: Switching between List and Board view preserves task selection without unmounting", async () => {
    renderTaskBoard();

    await waitFor(() => {
      expect(screen.getAllByText("Task Alpha")[0]).toBeInTheDocument();
    });

    // Select Task Alpha in Board view
    fireEvent.click(screen.getAllByText("Task Alpha")[0]);
    await waitFor(() => {
      expect(screen.getByTestId("board-overlay-drawer")).toBeInTheDocument();
    });

    // Switch viewMode to "list"
    act(() => {
      useUiStore.getState().setViewMode("list");
    });

    // Selection is preserved; now rendered in docked inspector for list view
    await waitFor(() => {
      expect(screen.getByTestId("docked-task-inspector")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Task Alpha")).toBeInTheDocument();
    });

    // Switch back to "board" view
    act(() => {
      useUiStore.getState().setViewMode("board");
    });

    // Selection is still preserved in board view overlay drawer
    await waitFor(() => {
      expect(screen.getByTestId("board-overlay-drawer")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Task Alpha")).toBeInTheDocument();
    });
  });
});
