import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskView } from "@/components/tasks/TaskView";
import { TaskEditorContext } from "@/components/tasks/TaskEditorProvider";
import type { Task } from "@/lib/types/task";
import type { TaskEditorState, TaskFormValues } from "@/lib/types/task-view";
import type { UseFormReturn } from "react-hook-form";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useSubtasks", () => ({
  useSubtasks: vi.fn(() => ({ data: [], isLoading: false })),
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
  default: ({
    value,
    isMobile,
  }: {
    value?: { freq?: string } | null;
    isMobile?: boolean;
  }) => (
    <div
      data-testid="recurrence-picker"
      data-recurrence={value?.freq ?? "none"}
      data-mobile={String(isMobile)}
    />
  ),
}));

vi.mock("@/components/tasks/SubtaskList", () => ({
  default: ({
    taskId,
    projectId,
    onCollapse,
  }: {
    taskId?: string;
    projectId?: string | null;
    onCollapse?: () => void;
  }) => (
    <div
      data-testid="subtask-list"
      data-task-id={taskId ?? ""}
      data-project-id={projectId ?? ""}
    >
      <button data-testid="subtask-collapse-btn" onClick={onCollapse}>
        Collapse
      </button>
    </div>
  ),
}));

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

function createMockEditorState(
  overrides: Partial<TaskEditorState> = {},
): TaskEditorState {
  return {
    task: null,
    mode: "create",
    form: {
      formState: { errors: {} },
    } as unknown as UseFormReturn<TaskFormValues>,
    content: "Test task",
    setContent: vi.fn(),
    description: "",
    setDescription: vi.fn(),
    dueDate: undefined,
    setDueDate: vi.fn(),
    doDate: undefined,
    setDoDate: vi.fn(),
    isEvening: false,
    setIsEvening: vi.fn(),
    priority: 4,
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
    pendingStep: "",
    setPendingStep: vi.fn(),
    inboxProjectId: "inbox-id",
    projects: [],
    isMobile: false,
    autoFocusTitle: false,
    isPending: false,
    hasContent: true,
    errors: {},
    onSubmit: vi.fn(),
    onKeyDown: vi.fn(),
    showDeleteDialog: false,
    setShowDeleteDialog: vi.fn(),
    onDeleteRequest: vi.fn(),
    onConfirmDelete: vi.fn(),
    deleteTitle: "Delete Task",
    deleteDescription: "Delete description",
    ...overrides,
  };
}

function renderTaskView(
  overrides: Partial<TaskEditorState> = {},
  layout?: "sheet" | "panel",
) {
  const state = createMockEditorState(overrides);
  const result = render(
    <TaskEditorContext.Provider value={state}>
      <TaskView layout={layout} />
    </TaskEditorContext.Provider>,
  );
  return { ...result, state };
}

describe("TaskView - create mode", () => {
  it("renders a create (Send) button and no delete button", () => {
    renderTaskView({ mode: "create" });

    expect(
      screen.getByRole("button", { name: /create task/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete task/i })).toBeNull();
  });

  it("passes an empty taskId and the inbox project to SubtaskList", () => {
    renderTaskView({ mode: "create", showSubtasks: true });

    const subtaskList = screen.getByTestId("subtask-list");
    expect(subtaskList.dataset.taskId).toBe("");
    expect(subtaskList.dataset.projectId).toBe("inbox-id");
  });

  it("renders the notes textarea in create mode and syncs edits", () => {
    const setDescription = vi.fn();
    renderTaskView({ mode: "create", setDescription });

    const textarea = screen.getByPlaceholderText("Add notes");
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "New note" } });
    expect(setDescription).toHaveBeenCalledWith("New note");
  });

  it("pressing bare Enter in the title textarea submits the task immediately", () => {
    const onSubmit = vi.fn();
    renderTaskView({ mode: "create", onSubmit });

    const titleInput = screen.getByPlaceholderText("What needs to be done?");
    fireEvent.keyDown(titleInput, { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("pressing Ctrl+Enter or Cmd+Enter in the title textarea submits the task", () => {
    const onSubmit = vi.fn();
    renderTaskView({ mode: "create", onSubmit });

    const titleInput = screen.getByPlaceholderText("What needs to be done?");
    fireEvent.keyDown(titleInput, { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(titleInput, { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("does not let a title Enter reach the surrounding sheet, which submits on Cmd+Enter too", () => {
    const onSubmit = vi.fn();
    const containerKeyDown = vi.fn();
    const state = createMockEditorState({ mode: "create", onSubmit });

    render(
      <div onKeyDown={containerKeyDown}>
        <TaskEditorContext.Provider value={state}>
          <TaskView />
        </TaskEditorContext.Provider>
      </div>,
    );

    const titleInput = screen.getByPlaceholderText("What needs to be done?");

    fireEvent.keyDown(titleInput, { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(containerKeyDown).not.toHaveBeenCalled();

    fireEvent.keyDown(titleInput, { key: "Enter" });
    expect(containerKeyDown).not.toHaveBeenCalled();
  });

  it("replaces newlines with spaces when text with newlines is entered or pasted", () => {
    const setContent = vi.fn();
    renderTaskView({ mode: "create", setContent });

    const titleInput = screen.getByPlaceholderText("What needs to be done?");
    fireEvent.change(titleInput, {
      target: { value: "Line 1\nLine 2\r\nLine 3" },
    });

    expect(setContent).toHaveBeenCalledWith("Line 1 Line 2 Line 3");
  });

  it("prevents default on Shift+Enter in title and does not submit", () => {
    const onSubmit = vi.fn();
    renderTaskView({ mode: "create", onSubmit });

    const titleInput = screen.getByPlaceholderText("What needs to be done?");
    const notPrevented = fireEvent.keyDown(titleInput, {
      key: "Enter",
      shiftKey: true,
    });

    expect(notPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("TaskView - edit mode", () => {
  const baseEditOverrides = {
    mode: "edit" as const,
    task: baseTask,
    description: "Existing notes",
  };

  it("renders Save and Delete buttons", () => {
    renderTaskView(baseEditOverrides);

    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete task/i }),
    ).toBeInTheDocument();
  });

  it("passes the initial task's id and project to SubtaskList", () => {
    renderTaskView({ ...baseEditOverrides, showSubtasks: true });

    const subtaskList = screen.getByTestId("subtask-list");
    expect(subtaskList.dataset.taskId).toBe("task-1");
    expect(subtaskList.dataset.projectId).toBe("project-1");
  });

  it("calls onDelete when the delete button is clicked", () => {
    const onDeleteRequest = vi.fn();
    renderTaskView({ ...baseEditOverrides, onDeleteRequest });

    fireEvent.click(screen.getByRole("button", { name: /delete task/i }));
    expect(onDeleteRequest).toHaveBeenCalled();
  });

  it("renders the notes row and syncs edits back", () => {
    const setDescription = vi.fn();
    renderTaskView({ ...baseEditOverrides, setDescription });

    fireEvent.click(screen.getByRole("button", { name: /notes/i }));

    const textarea = screen.getByRole("textbox", { name: /notes/i });
    expect(textarea).toHaveValue("Existing notes");

    fireEvent.change(textarea, { target: { value: "Updated notes" } });
    expect(setDescription).toHaveBeenCalledWith("Updated notes");
  });

  it("pressing bare Enter in the title submits the form in edit mode too", () => {
    const onSubmit = vi.fn();
    renderTaskView({ ...baseEditOverrides, onSubmit });

    const titleInput = screen.getByPlaceholderText("What needs to be done?");
    fireEvent.keyDown(titleInput, { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("pressing Cmd+Enter or Ctrl+Enter in edit mode title submits the form", () => {
    const onSubmit = vi.fn();
    renderTaskView({ ...baseEditOverrides, onSubmit });

    const titleInput = screen.getByPlaceholderText("What needs to be done?");
    fireEvent.keyDown(titleInput, { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(titleInput, { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("collapses subtasks and focuses title textarea when onCollapse is triggered", () => {
    const setShowSubtasks = vi.fn();
    renderTaskView({
      ...baseEditOverrides,
      showSubtasks: true,
      setShowSubtasks,
    });

    const titleInput = screen.getByPlaceholderText("What needs to be done?");
    const collapseBtn = screen.getByTestId("subtask-collapse-btn");

    fireEvent.click(collapseBtn);
    expect(setShowSubtasks).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(titleInput);
  });

  it("forwards recurrence and isMobile props to RecurrencePicker in edit mode", () => {
    renderTaskView({
      ...baseEditOverrides,
      recurrence: { freq: "WEEKLY", interval: 1 },
      isMobile: true,
    });

    const picker = screen.getByTestId("recurrence-picker");
    expect(picker.getAttribute("data-recurrence")).toBe("WEEKLY");
    expect(picker.getAttribute("data-mobile")).toBe("true");
  });
});
