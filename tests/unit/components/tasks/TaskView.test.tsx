import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskView } from "@/components/tasks/TaskView";
import type { Task } from "@/lib/types/task";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn().mockReturnValue(false),
}));

vi.mock("@/components/tasks/shared/TaskDatePicker", () => ({
  TaskDatePicker: () => <div data-testid="date-picker" />,
}));

vi.mock("@/components/tasks/shared/TaskPrioritySelect", () => ({
  TaskPrioritySelect: () => <div data-testid="priority-select" />,
}));

vi.mock("@/components/tasks/TaskSheet/RecurrencePicker", () => ({
  default: () => <div data-testid="recurrence-picker" />,
}));

vi.mock("@/components/tasks/SubtaskList", () => ({
  default: ({
    taskId,
    projectId,
  }: {
    taskId?: string;
    projectId?: string | null;
  }) => (
    <div
      data-testid="subtask-list"
      data-task-id={taskId ?? ""}
      data-project-id={projectId ?? ""}
    />
  ),
}));

vi.mock("@/components/tasks/shared/TaskNotesEditor", () => ({
  TaskNotesEditor: ({
    open,
    onOpenChange,
    description,
    setDescription,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    description: string;
    setDescription: (value: string) => void;
  }) =>
    open ? (
      <div data-testid="notes-editor">
        <textarea
          aria-label="Notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
}));

const baseProps = {
  content: "Test task",
  setContent: vi.fn(),
  description: "",
  setDescription: vi.fn(),
  isPreviewMode: false,
  setIsPreviewMode: vi.fn(),
  dueDate: undefined,
  setDueDate: vi.fn(),
  doDate: undefined,
  setDoDate: vi.fn(),
  setIsEvening: vi.fn(),
  priority: 4 as const,
  setPriority: vi.fn(),
  recurrence: null,
  setRecurrence: vi.fn(),
  selectedProjectId: null,
  setSelectedProjectId: vi.fn(),
  datePickerOpen: false,
  setDatePickerOpen: vi.fn(),
  doDatePickerOpen: false,
  setDoDatePickerOpen: vi.fn(),
  showSubtasks: false,
  setShowSubtasks: vi.fn(),
  draftSubtasks: [],
  setDraftSubtasks: vi.fn(),
  inboxProjectId: "inbox-id",
  projects: [],
  isMobile: false,
  hasContent: true,
  isPending: false,
  onSubmit: vi.fn(),
  onKeyDown: vi.fn(),
};

const baseTask: Task = {
  id: "task-1",
  content: "Test Task",
  description: "Existing notes",
  priority: 4,
  is_completed: false,
  created_at: new Date().toISOString(),
  user_id: "user-1",
  project_id: "project-1",
} as Task;

describe("TaskView - create mode", () => {
  it("renders a create (Send) button and no delete button", () => {
    render(<TaskView {...baseProps} mode="create" />);

    expect(
      screen.getByRole("button", { name: /create task/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete task/i })).toBeNull();
  });

  it("passes an empty taskId and the inbox project to SubtaskList", () => {
    render(<TaskView {...baseProps} mode="create" showSubtasks={true} />);

    const subtaskList = screen.getByTestId("subtask-list");
    expect(subtaskList.dataset.taskId).toBe("");
    expect(subtaskList.dataset.projectId).toBe("inbox-id");
  });

  it("opening the Notes row defaults the editor to edit mode", () => {
    render(<TaskView {...baseProps} mode="create" />);

    fireEvent.click(screen.getByRole("button", { name: /add details/i }));

    expect(baseProps.setIsPreviewMode).toHaveBeenCalledWith(false);
  });
});

describe("TaskView - edit mode", () => {
  const editProps = {
    ...baseProps,
    description: "Existing notes",
    initialTask: baseTask,
    onDelete: vi.fn(),
  };

  it("renders Save and Delete buttons", () => {
    render(<TaskView {...editProps} mode="edit" />);

    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete task/i }),
    ).toBeInTheDocument();
  });

  it("passes the initial task's id and project to SubtaskList", () => {
    render(<TaskView {...editProps} mode="edit" showSubtasks={true} />);

    const subtaskList = screen.getByTestId("subtask-list");
    expect(subtaskList.dataset.taskId).toBe("task-1");
    expect(subtaskList.dataset.projectId).toBe("project-1");
  });

  it("calls onDelete when the delete button is clicked", () => {
    render(<TaskView {...editProps} mode="edit" />);

    fireEvent.click(screen.getByRole("button", { name: /delete task/i }));
    expect(editProps.onDelete).toHaveBeenCalled();
  });

  it("opening the Notes row defaults the editor to preview mode", () => {
    render(<TaskView {...editProps} mode="edit" />);

    fireEvent.click(screen.getByRole("button", { name: /notes/i }));

    expect(editProps.setIsPreviewMode).toHaveBeenCalledWith(true);
  });

  it("opens the notes editor when the Notes row is clicked and syncs edits back", () => {
    render(<TaskView {...editProps} mode="edit" />);

    fireEvent.click(screen.getByRole("button", { name: /notes/i }));

    const editor = screen.getByTestId("notes-editor");
    const textarea = screen.getByRole("textbox", { name: /notes/i });
    expect(textarea).toHaveValue("Existing notes");

    fireEvent.change(textarea, { target: { value: "Updated notes" } });
    expect(editProps.setDescription).toHaveBeenCalledWith("Updated notes");

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(editor).not.toBeInTheDocument();
  });
});
