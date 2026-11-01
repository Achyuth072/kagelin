import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SplitViewLayout } from "@/components/tasks/SplitViewLayout";
import type { Task } from "@/lib/types/task";

vi.mock("@/components/tasks/TaskList", () => ({
  default: ({ onTaskSelect }: { onTaskSelect: (task: Task) => void }) => (
    <div data-testid="task-list">
      <button
        onClick={() =>
          onTaskSelect({ id: "task-1", content: "Selected Task" } as Task)
        }
      >
        Select Task 1
      </button>
    </div>
  ),
}));

vi.mock("@/components/tasks/TaskDetailPanel", () => ({
  TaskDetailPanel: ({
    task,
    onClose,
  }: {
    task: Task | null;
    onClose: () => void;
  }) => (
    <div data-testid="task-detail-panel">
      {task ? (
        <>
          <span>{task.content}</span>
          <button onClick={onClose}>Close Detail</button>
        </>
      ) : (
        <span>Empty State</span>
      )}
    </div>
  ),
}));

const mockHapticTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockHapticTrigger,
  }),
}));

let mockIsWide = true;
vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: (query: string) => {
    if (query.includes("1280")) return mockIsWide;
    return true;
  },
}));

let queryClient: QueryClient;

function renderLayout() {
  return render(
    <QueryClientProvider client={queryClient}>
      <SplitViewLayout />
    </QueryClientProvider>,
  );
}

describe("SplitViewLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsWide = true;
    queryClient = new QueryClient();
  });

  it("SV-N-01: Renders task list at 100% width by default with no empty placeholder pane", () => {
    renderLayout();

    const listContainer = screen.getByTestId("task-list").parentElement;
    expect(listContainer).toHaveClass("w-full");
    expect(screen.queryByText("Empty State")).not.toBeInTheDocument();
  });

  it("SV-N-02: Expands side inspector (w-[40%], duration-200, pt-2) and shrinks list to w-[60%] when a task is selected", () => {
    renderLayout();

    const selectBtn = screen.getByText("Select Task 1");
    fireEvent.click(selectBtn);

    expect(screen.getByText("Selected Task")).toBeInTheDocument();
    expect(mockHapticTrigger).toHaveBeenCalledWith("toggle");

    const listContainer = screen.getByTestId("task-list").parentElement;
    expect(listContainer).toHaveClass("w-[60%]");

    const inspector = screen.getByTestId("docked-task-inspector");
    expect(inspector).toHaveClass("w-[40%]");
    expect(inspector).toHaveClass("pt-2");
    expect(inspector).toHaveClass("duration-200");
  });

  it("SV-N-03: Returns to 100% width when detail panel is closed", () => {
    renderLayout();
    fireEvent.click(screen.getByText("Select Task 1"));

    const closeBtn = screen.getByText("Close Detail");
    fireEvent.click(closeBtn);

    const listContainer = screen.getByTestId("task-list").parentElement;
    expect(listContainer).toHaveClass("w-full");
    expect(screen.queryByText("Selected Task")).not.toBeInTheDocument();
    expect(mockHapticTrigger).toHaveBeenCalledWith("tick");
  });

  it("SV-N-04: Detail panel follows cache edits to the selected task", () => {
    const queryKey = ["tasks", { projectId: undefined }];
    queryClient.setQueryData(queryKey, [
      { id: "task-1", content: "Selected Task" },
    ]);
    renderLayout();
    fireEvent.click(screen.getByText("Select Task 1"));

    act(() => {
      queryClient.setQueryData<Task[]>(queryKey, (old) =>
        old?.map((t) => ({ ...t, content: "Edited Task" })),
      );
    });

    expect(screen.getByText("Edited Task")).toBeInTheDocument();
  });

  it("SV-N-05: Routes viewports <1280px through modal and >=1280px to docked pane", () => {
    mockIsWide = false;
    renderLayout();

    expect(
      screen.queryByTestId("docked-task-inspector"),
    ).not.toBeInTheDocument();

    const selectBtn = screen.getByText("Select Task 1");
    fireEvent.click(selectBtn);

    // Modal Dialog should render for <1280px viewports
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.queryByTestId("docked-task-inspector"),
    ).not.toBeInTheDocument();
  });
});
