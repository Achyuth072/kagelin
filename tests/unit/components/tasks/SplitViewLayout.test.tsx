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

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true,
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
    queryClient = new QueryClient();
  });

  it("SV-N-01: Renders with no selected task by default", () => {
    renderLayout();

    expect(screen.getByText("Empty State")).toBeInTheDocument();
  });

  it("SV-N-02: Updates detail panel when a task is selected", () => {
    renderLayout();

    const selectBtn = screen.getByText("Select Task 1");
    fireEvent.click(selectBtn);

    expect(screen.getByText("Selected Task")).toBeInTheDocument();
    expect(mockHapticTrigger).toHaveBeenCalledWith("toggle");
  });

  it("SV-N-03: Returns to empty state when detail panel is closed", () => {
    renderLayout();
    fireEvent.click(screen.getByText("Select Task 1"));
    expect(screen.queryByText("Empty State")).not.toBeInTheDocument();

    const closeBtn = screen.getByText("Close Detail");
    fireEvent.click(closeBtn);

    expect(screen.getByText("Empty State")).toBeInTheDocument();
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

  it("SV-03: Has a fixed 60/40 layout split", () => {
    renderLayout();

    const listContainer = screen.getByTestId("task-list").parentElement;
    const detailContainer =
      screen.getByTestId("task-detail-panel").parentElement?.parentElement;

    expect(listContainer).toHaveClass("w-[60%]");
    expect(detailContainer).toHaveClass("w-[40%]");
  });
});
