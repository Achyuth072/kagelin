import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { FocusSubtaskList } from "@/components/FocusSubtaskList";
import type { Task } from "@/lib/types/task";

const { mockTrigger, mockUseSubtasks, mockUseActiveTask } = vi.hoisted(() => ({
  mockTrigger: vi.fn(),
  mockUseSubtasks: vi.fn(),
  mockUseActiveTask: vi.fn(),
}));

let mockActiveTaskId: string | null = null;

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockTrigger,
    isPhone: false,
    hapticsEnabled: true,
  }),
}));

vi.mock("@/lib/store/timerStore", () => ({
  useTimerStore: (
    selector: (state: { state: { activeTaskId: string | null } }) => unknown,
  ) => {
    return selector({ state: { activeTaskId: mockActiveTaskId } });
  },
}));

vi.mock("@/lib/hooks/useActiveTask", () => ({
  useActiveTask: (id: string | null) => mockUseActiveTask(id),
}));

vi.mock("@/lib/hooks/useSubtasks", () => ({
  useSubtasks: (id: string | null) => mockUseSubtasks(id),
}));

vi.mock("@/components/tasks/SubtaskList", () => ({
  __esModule: true,
  default: ({
    taskId,
    projectId,
    allowReorder,
    onCollapse,
  }: {
    taskId?: string;
    projectId?: string | null;
    allowReorder?: boolean;
    onCollapse?: () => void;
  }) => (
    <div
      data-testid="subtask-list"
      data-task-id={taskId}
      data-project-id={projectId}
      data-allow-reorder={allowReorder}
    >
      <span>SubtaskList Mock</span>
      <button onClick={onCollapse} data-testid="mock-collapse-btn">
        Collapse
      </button>
    </div>
  ),
}));

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    user_id: "user-1",
    project_id: "proj-1",
    parent_id: null,
    content: "Parent task",
    description: null,
    priority: 4,
    due_date: null,
    do_date: null,
    is_evening: false,
    is_completed: false,
    completed_at: null,
    day_order: 0,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockStep(id: string, is_completed: boolean): Task {
  return createMockTask({
    id,
    parent_id: "task-1",
    content: `Step ${id}`,
    is_completed,
  });
}

describe("FocusSubtaskList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveTaskId = "task-1";
    mockUseActiveTask.mockReturnValue({
      data: createMockTask({ id: "task-1", project_id: "proj-1" }),
      isLoading: false,
    });
    mockUseSubtasks.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it("renders nothing when there is no activeTaskId", () => {
    mockActiveTaskId = null;
    mockUseSubtasks.mockReturnValue({ data: [], isLoading: false });

    const { container } = render(<FocusSubtaskList />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when active task has zero steps", () => {
    mockActiveTaskId = "task-1";
    mockUseSubtasks.mockReturnValue({ data: [], isLoading: false });

    const { container } = render(<FocusSubtaskList />);
    expect(container.firstChild).toBeNull();
  });

  it("renders collapsed toggle button with '▸ 2/5 steps' when active task has steps", () => {
    mockActiveTaskId = "task-1";
    const steps = [
      createMockStep("s1", true),
      createMockStep("s2", true),
      createMockStep("s3", false),
      createMockStep("s4", false),
      createMockStep("s5", false),
    ];
    mockUseSubtasks.mockReturnValue({ data: steps, isLoading: false });

    render(<FocusSubtaskList />);

    const toggleButton = screen.getByRole("button", { name: /2\/5 steps/i });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton.textContent).toContain("▸");
    expect(toggleButton.textContent).toContain("2/5 steps");
    expect(screen.queryByTestId("subtask-list")).not.toBeInTheDocument();
  });

  it("expands checklist when toggle button is clicked", () => {
    mockActiveTaskId = "task-1";
    const steps = [createMockStep("s1", false), createMockStep("s2", false)];
    mockUseSubtasks.mockReturnValue({ data: steps, isLoading: false });

    render(<FocusSubtaskList />);

    const toggleButton = screen.getByRole("button", { name: /0\/2 steps/i });
    fireEvent.click(toggleButton);

    expect(mockTrigger).toHaveBeenCalledWith("toggle");
    expect(toggleButton.textContent).toContain("▾");
    expect(toggleButton.textContent).toContain("0/2 steps");
    expect(screen.getByTestId("subtask-list")).toBeInTheDocument();
    expect(screen.getByTestId("subtask-list")).toHaveAttribute(
      "data-allow-reorder",
      "false",
    );
  });

  it("collapses checklist when toggle button is clicked again", () => {
    mockActiveTaskId = "task-1";
    const steps = [createMockStep("s1", false)];
    mockUseSubtasks.mockReturnValue({ data: steps, isLoading: false });

    render(<FocusSubtaskList />);

    const toggleButton = screen.getByRole("button", { name: /0\/1 steps/i });
    fireEvent.click(toggleButton);
    expect(screen.getByTestId("subtask-list")).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.queryByTestId("subtask-list")).not.toBeInTheDocument();
    expect(toggleButton.textContent).toContain("▸");
  });

  it("updates toggle label dynamically as steps change", () => {
    mockActiveTaskId = "task-1";
    let steps = [
      createMockStep("s1", true),
      createMockStep("s2", false),
      createMockStep("s3", false),
    ];
    mockUseSubtasks.mockImplementation(() => ({
      data: steps,
      isLoading: false,
    }));

    const { rerender } = render(<FocusSubtaskList />);

    expect(
      screen.getByRole("button", { name: /1\/3 steps/i }),
    ).toBeInTheDocument();

    // Step 2 is checked off
    steps = [
      createMockStep("s1", true),
      createMockStep("s2", true),
      createMockStep("s3", false),
    ];
    rerender(<FocusSubtaskList />);

    expect(
      screen.getByRole("button", { name: /2\/3 steps/i }),
    ).toBeInTheDocument();
  });

  it("triggers 'success' haptic pulse when the final step is checked off", () => {
    mockActiveTaskId = "task-1";
    let steps = [createMockStep("s1", true), createMockStep("s2", false)];
    mockUseSubtasks.mockImplementation(() => ({
      data: steps,
      isLoading: false,
    }));

    const { rerender } = render(<FocusSubtaskList />);
    expect(mockTrigger).not.toHaveBeenCalledWith("success");

    // Final step completed
    steps = [createMockStep("s1", true), createMockStep("s2", true)];
    rerender(<FocusSubtaskList />);

    expect(mockTrigger).toHaveBeenCalledWith("success");
  });

  it("does not trigger 'success' haptic pulse on initial render when all steps are already completed", () => {
    mockActiveTaskId = "task-1";
    const steps = [createMockStep("s1", true), createMockStep("s2", true)];
    mockUseSubtasks.mockReturnValue({ data: steps, isLoading: false });

    render(<FocusSubtaskList />);
    expect(mockTrigger).not.toHaveBeenCalledWith("success");
  });

  it("does not trigger 'success' haptic pulse when active task switches to another task with all steps completed", () => {
    mockActiveTaskId = "task-1";
    let steps = [createMockStep("s1", true), createMockStep("s2", false)];
    mockUseSubtasks.mockImplementation(() => ({
      data: steps,
      isLoading: false,
    }));

    const { rerender } = render(<FocusSubtaskList />);

    // Switch task
    mockActiveTaskId = "task-2";
    steps = [
      createMockTask({ id: "s3", parent_id: "task-2", is_completed: true }),
    ];
    rerender(<FocusSubtaskList />);

    expect(mockTrigger).not.toHaveBeenCalledWith("success");
  });

  it("does not trigger 'success' haptic pulse when subtasks load from undefined to all completed", () => {
    mockActiveTaskId = "task-1";
    let subtasksData: Task[] | undefined = undefined;
    mockUseSubtasks.mockImplementation(() => ({
      data: subtasksData,
      isLoading: subtasksData === undefined,
    }));

    const { rerender } = render(<FocusSubtaskList />);
    expect(mockTrigger).not.toHaveBeenCalledWith("success");

    // Data finishes loading with all steps completed
    subtasksData = [createMockStep("s1", true), createMockStep("s2", true)];
    rerender(<FocusSubtaskList />);

    expect(mockTrigger).not.toHaveBeenCalledWith("success");
  });
});
