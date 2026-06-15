import type React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskEditView } from "@/components/tasks/TaskEditView";
import type { Task } from "@/lib/types/task";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn().mockReturnValue(false),
}));

vi.mock("./shared/TaskDatePicker", () => ({
  TaskDatePicker: () => <div data-testid="date-picker" />,
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
  default: () => <div data-testid="subtask-list" />,
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

describe("TaskEditView - Notes row", () => {
  const baseTask: Task = {
    id: "task-1",
    content: "Test Task",
    description: "Existing notes",
    priority: 4,
    is_completed: false,
    created_at: new Date().toISOString(),
    user_id: "user-1",
  } as Task;

  const baseProps = {
    initialTask: baseTask,
    content: "Test Task",
    setContent: vi.fn(),
    description: "Existing notes",
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
    onDelete: vi.fn(),
    onKeyDown: vi.fn(),
  };

  it("renders a Notes trigger row instead of the inline description editor", () => {
    render(<TaskEditView {...baseProps} />);

    expect(screen.getByRole("button", { name: /notes/i })).toBeInTheDocument();
    expect(screen.queryByTestId("notes-editor")).toBeNull();
  });

  it("opening the Notes row defaults the editor to preview mode", () => {
    render(<TaskEditView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /notes/i }));

    expect(baseProps.setIsPreviewMode).toHaveBeenCalledWith(true);
  });

  it("opens the notes editor when the Notes row is clicked and syncs edits back", () => {
    render(<TaskEditView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /notes/i }));

    const editor = screen.getByTestId("notes-editor");
    const textarea = screen.getByRole("textbox", { name: /notes/i });
    expect(textarea).toHaveValue("Existing notes");

    fireEvent.change(textarea, { target: { value: "Updated notes" } });
    expect(baseProps.setDescription).toHaveBeenCalledWith("Updated notes");

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(editor).not.toBeInTheDocument();
  });
});
