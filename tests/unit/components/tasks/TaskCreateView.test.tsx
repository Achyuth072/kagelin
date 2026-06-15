import type React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskCreateView } from "@/components/tasks/TaskCreateView";

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

describe("TaskCreateView - Notes row", () => {
  const baseProps = {
    content: "New task",
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

  it("renders a Notes trigger row", () => {
    render(<TaskCreateView {...baseProps} />);

    expect(
      screen.getByRole("button", { name: /add details/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("notes-editor")).toBeNull();
  });

  it("opening the Notes row defaults the editor to edit mode", () => {
    render(<TaskCreateView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /add details/i }));

    expect(baseProps.setIsPreviewMode).toHaveBeenCalledWith(false);
  });

  it("opens the notes editor when the Notes row is clicked and syncs edits back", () => {
    render(<TaskCreateView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /add details/i }));

    const editor = screen.getByTestId("notes-editor");
    const textarea = screen.getByRole("textbox", { name: /notes/i });
    expect(textarea).toHaveValue("");

    fireEvent.change(textarea, { target: { value: "Draft notes" } });
    expect(baseProps.setDescription).toHaveBeenCalledWith("Draft notes");

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(editor).not.toBeInTheDocument();
  });
});
