import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import {
  AppMigrationDialog,
  ImportDialog,
} from "@/components/settings/AppMigrationDialog";
import type { IcsImportPreview } from "@/lib/hooks/useIcsImport";
import type { TodoistPreview } from "@/lib/hooks/useTodoistImport";
import type { GoogleTasksImportPreview } from "@/lib/import/google-tasks/types";

const {
  triggerMock,
  prepareImportMock,
  commitImportMock,
  cancelImportMock,
  prepareTodoistImportMock,
  commitTodoistImportMock,
  cancelTodoistImportMock,
  prepareOAuthImportMock,
  prepareGoogleTasksTakeoutImportMock,
  commitGoogleTasksImportMock,
  cancelGoogleTasksImportMock,
} = vi.hoisted(() => ({
  triggerMock: vi.fn(),
  prepareImportMock: vi.fn(),
  commitImportMock: vi.fn(),
  cancelImportMock: vi.fn(),
  prepareTodoistImportMock: vi.fn(),
  commitTodoistImportMock: vi.fn(),
  cancelTodoistImportMock: vi.fn(),
  prepareOAuthImportMock: vi.fn(),
  prepareGoogleTasksTakeoutImportMock: vi.fn(),
  commitGoogleTasksImportMock: vi.fn(),
  cancelGoogleTasksImportMock: vi.fn(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: triggerMock }),
}));

vi.mock("@/lib/hooks/useHabits", () => ({
  useHabits: () => ({ data: [] }),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => ({ data: [] }),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: () => ({ data: [] }),
}));

vi.mock("@/lib/hooks/useUhabitsExport", () => ({
  useUhabitsExport: () => ({
    exportLoopDb: vi.fn(),
    exportLoopZip: vi.fn(),
    isExporting: false,
  }),
}));

vi.mock("@/lib/hooks/useTodoistExport", () => ({
  useTodoistExport: () => ({
    exportTodoistZip: vi.fn(),
    isExporting: false,
  }),
}));

vi.mock("@/lib/hooks/useUhabitsImport", () => ({
  useUhabitsImport: () => ({ importUhabits: vi.fn(), isImporting: false }),
}));

vi.mock("@/lib/hooks/useTodoistImport", () => {
  return {
    useTodoistImport: () => {
      const [preview, setPreview] = useState<TodoistPreview | null>(null);
      return {
        prepareImport: async (file: File) => {
          const result = await prepareTodoistImportMock(file);
          setPreview(result);
          return result;
        },
        commitImport: async () => {
          const success = await commitTodoistImportMock();
          setPreview(null);
          return success;
        },
        cancelImport: () => {
          cancelTodoistImportMock();
          setPreview(null);
        },
        preview,
        isImporting: false,
        fileName: "test.csv",
      };
    },
  };
});

vi.mock("@/lib/hooks/useIcsImport", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/hooks/useIcsImport")>();
  return {
    ...actual,
    useIcsImport: () => {
      const [preview, setPreview] = useState<IcsImportPreview | null>(null);
      return {
        prepareImport: async (file: File) => {
          const result = await prepareImportMock(file);
          setPreview(result);
          return result;
        },
        commitImport: async (target?: IcsImportPreview | null) => {
          const success = await commitImportMock(target ?? preview);
          setPreview(null);
          return success;
        },
        cancelImport: () => {
          cancelImportMock();
          setPreview(null);
        },
        preview,
        isImporting: false,
      };
    },
  };
});

let mockGoogleTasksPreview: GoogleTasksImportPreview | null = null;
let mockIsGuestMode = false;

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: mockIsGuestMode, user: { id: "test-user" } }),
}));

vi.mock("@/lib/hooks/useGoogleTasksImport", () => ({
  useGoogleTasksImport: () => {
    return {
      prepareOAuthImport: async (token?: string) => {
        return prepareOAuthImportMock(token);
      },
      prepareTakeoutImport: async (file: File) => {
        return prepareGoogleTasksTakeoutImportMock(file);
      },
      commitImport: async (
        targetPreview?: GoogleTasksImportPreview | null,
        options?: { includeCompleted?: boolean },
      ) => {
        return commitGoogleTasksImportMock(targetPreview, options);
      },
      cancelImport: () => {
        cancelGoogleTasksImportMock();
      },
      preview: mockGoogleTasksPreview,
      state: "idle",
      isImporting: false,
    };
  },
}));

describe("AppMigrationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoogleTasksPreview = null;
    mockIsGuestMode = false;
    commitImportMock.mockResolvedValue(true);
    commitGoogleTasksImportMock.mockResolvedValue(true);
  });

  it("exports ImportDialog as backwards-compatible alias", () => {
    expect(ImportDialog).toBe(AppMigrationDialog);
  });

  it("renders default Import tab with input triggers", () => {
    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: /import/i })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("tab", { name: /export/i })).toHaveAttribute(
      "data-state",
      "inactive",
    );

    // Import options should be present
    expect(screen.getByText("ICS (Calendar)")).toBeInTheDocument();
    expect(screen.getByText("Loop Habit Tracker")).toBeInTheDocument();
    expect(screen.getByText("Todoist")).toBeInTheDocument();
    expect(screen.getByText("Google Tasks")).toBeInTheDocument();
  });

  it("switches to Export tab, plays haptics, and displays export cards", () => {
    const { rerender } = render(
      <AppMigrationDialog open onOpenChange={vi.fn()} />,
    );

    const exportTab = screen.getByRole("tab", { name: /export/i });
    fireEvent.pointerDown(exportTab);
    fireEvent.mouseDown(exportTab);
    fireEvent.click(exportTab);

    expect(triggerMock).toHaveBeenCalledWith("toggle");
    expect(exportTab).toHaveAttribute("data-state", "active");

    // Export cards should be rendered
    expect(
      screen.getByRole("button", {
        name: "Export Loop Habit Tracker",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Export Todoist ZIP archive",
      }),
    ).toBeInTheDocument();

    // Closing and reopening resets to default tab
    rerender(<AppMigrationDialog open={false} onOpenChange={vi.fn()} />);
    rerender(<AppMigrationDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /import/i })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  it("handles dialog close via close button", () => {
    const onOpenChange = vi.fn();
    render(<AppMigrationDialog open onOpenChange={onOpenChange} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("supports defaultTab prop to open on Export tab directly", () => {
    render(
      <AppMigrationDialog open onOpenChange={vi.fn()} defaultTab="export" />,
    );

    expect(screen.getByRole("tab", { name: /export/i })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("tab", { name: /import/i })).toHaveAttribute(
      "data-state",
      "inactive",
    );
    expect(
      screen.getByRole("button", {
        name: "Export Todoist ZIP archive",
      }),
    ).toBeInTheDocument();
  });

  it("constrains layout with bounded flex-col scroll container to prevent overscrolling on mobile", () => {
    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    // ResponsiveDialogContent portals to document body with overflow-hidden and flex flex-col with max-h
    const dialogContent = screen.getByRole("dialog");
    expect(dialogContent).toBeInTheDocument();
    expect(dialogContent).toHaveClass("overflow-hidden");
    expect(dialogContent).toHaveClass("flex-col");

    // The scrollable inner body should have overflow-y-auto and flex-1 min-h-0
    const scrollableBody = document.querySelector(".overflow-y-auto");
    expect(scrollableBody).toBeInTheDocument();
    expect(scrollableBody).toHaveClass("flex-1");
    expect(scrollableBody).toHaveClass("min-h-0");
  });

  it("renders Google Tasks card with dual actions for registered users and clean unified file card for guests", () => {
    mockIsGuestMode = false;
    const { rerender } = render(
      <AppMigrationDialog open onOpenChange={vi.fn()} />,
    );

    expect(screen.getByText("Google Tasks")).toBeInTheDocument();
    const entryCard = screen.getByRole("button", {
      name: "Google Tasks import options",
    });
    expect(entryCard).toBeInTheDocument();

    // Click entry card to drill down
    fireEvent.click(entryCard);

    const connectButton = screen.getByRole("button", {
      name: "Connect Google Tasks",
    });
    const takeoutButton = screen.getByRole("button", {
      name: "Import Google Tasks Takeout JSON file",
    });

    expect(connectButton).toBeEnabled();
    expect(takeoutButton).toBeEnabled();

    fireEvent.click(connectButton);
    expect(prepareOAuthImportMock).toHaveBeenCalled();

    // Test back button
    const backBtn = screen.getByRole("button", { name: "Back to all apps" });
    fireEvent.click(backBtn);
    expect(
      screen.getByRole("button", { name: "Google Tasks import options" }),
    ).toBeInTheDocument();

    // Rerender as Guest mode
    mockIsGuestMode = true;
    rerender(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    // In guest mode, dead OAuth button and disclaimer text are removed
    expect(
      screen.queryByRole("button", { name: "Google Tasks import options" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect Google Tasks" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/OAuth import requires a registered account/i),
    ).not.toBeInTheDocument();

    // Guest sees a unified 1-click import card matching the other cards
    const guestCard = screen.getByRole("button", {
      name: "Import Google Tasks from Takeout JSON",
    });
    expect(guestCard).toBeInTheDocument();
    expect(screen.getByText("Import from Takeout .json")).toBeInTheDocument();

    fireEvent.click(guestCard);
    expect(triggerMock).toHaveBeenCalledWith("toggle");
  });

  it("renders Google Tasks preview with total task count, project count, skipped duplicates, and flattened subtasks", () => {
    mockIsGuestMode = false;
    mockGoogleTasksPreview = {
      kind: "google-tasks",
      projects: [
        {
          listId: "l1",
          name: "Project 1",
          isInbox: false,
          status: "new",
          color: "#4285F4",
          existingProjectId: null,
          tasks: [
            {
              id: "t1",
              tempId: "tmp1",
              parentId: null,
              tempParentId: null,
              content: "Task 1",
              description: null,
              dueDate: null,
              isCompleted: false,
              completedAt: null,
              dayOrder: 1,
              listId: "l1",
              originalDepth: 0,
            },
            {
              id: "t2",
              tempId: "tmp2",
              parentId: "t1",
              tempParentId: "tmp1",
              content: "Subtask 1",
              description: "[Context: Task 1]",
              dueDate: null,
              isCompleted: false,
              completedAt: null,
              dayOrder: 2,
              listId: "l1",
              originalDepth: 2,
            },
          ],
          duplicatesSkipped: 1,
          parentRedirects: {},
          subtasksReassigned: 0,
        },
      ],
      totalTasks: 2,
      rootTasksCount: 1,
      subtasksCount: 1,
      earliestDate: null,
      latestDate: null,
      newProjectCount: 1,
      mergedProjectCount: 0,
      duplicateTasksSkipped: 1,
      subtasksReassigned: 0,
      rawSource: { lists: [], tasksByListId: {} },
    };

    const onOpenChange = vi.fn();
    render(<AppMigrationDialog open onOpenChange={onOpenChange} />);

    expect(screen.getByText("Confirm Google Tasks Import")).toBeInTheDocument();
    expect(screen.getByText("Total tasks found")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Nested steps flattened")).toBeInTheDocument();
    expect(screen.getByText("Duplicates skipped")).toBeInTheDocument();
    expect(screen.getByText("Projects detected")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);

    const commitBtn = screen.getByRole("button", {
      name: "Import 2 tasks",
    });
    fireEvent.click(commitBtn);
    expect(commitGoogleTasksImportMock).toHaveBeenCalledWith(undefined, {
      includeCompleted: true,
    });
  });

  it("handles Google Tasks Takeout JSON file selection and drag-drop in registered mode", async () => {
    mockIsGuestMode = false;
    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    // Open drill-down subview
    const entryCard = screen.getByRole("button", {
      name: "Google Tasks import options",
    });
    fireEvent.click(entryCard);

    const takeoutBtn = screen.getByRole("button", {
      name: "Import Google Tasks Takeout JSON file",
    });
    expect(takeoutBtn).toBeInTheDocument();

    const fileInput = screen.getByLabelText(
      "Upload Google Takeout Tasks.json file",
    ) as HTMLInputElement;

    const file = new File(['{"items":[]}'], "Tasks.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(prepareGoogleTasksTakeoutImportMock).toHaveBeenCalledWith(file);

    // Test drag-and-drop on the Google Tasks card
    const dropFile = new File(['{"items":[]}'], "DroppedTasks.json", {
      type: "application/json",
    });
    fireEvent.drop(takeoutBtn, {
      dataTransfer: { files: [dropFile] },
    });

    expect(prepareGoogleTasksTakeoutImportMock).toHaveBeenCalledWith(dropFile);
  });

  it("handles Google Tasks Takeout JSON file selection and drag-drop in guest mode", async () => {
    mockIsGuestMode = true;
    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    const guestCard = screen.getByRole("button", {
      name: "Import Google Tasks from Takeout JSON",
    });
    expect(guestCard).toBeInTheDocument();

    const fileInput = screen.getByLabelText(
      "Upload Google Takeout Tasks.json file",
    ) as HTMLInputElement;

    const file = new File(['{"items":[]}'], "Tasks.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(prepareGoogleTasksTakeoutImportMock).toHaveBeenCalledWith(file);

    // Test drag-and-drop on the guest card
    const dropFile = new File(['{"items":[]}'], "GuestDropped.json", {
      type: "application/json",
    });
    fireEvent.drop(guestCard, {
      dataTransfer: { files: [dropFile] },
    });

    expect(prepareGoogleTasksTakeoutImportMock).toHaveBeenCalledWith(dropFile);
  });

  it("allows toggling completed tasks in Google Tasks preview and canceling import", () => {
    mockIsGuestMode = false;
    mockGoogleTasksPreview = {
      kind: "google-tasks",
      projects: [
        {
          listId: "l1",
          name: "Project 1",
          isInbox: false,
          status: "new",
          color: "#4285F4",
          existingProjectId: null,
          tasks: [
            {
              id: "t1",
              tempId: "tmp1",
              parentId: null,
              tempParentId: null,
              content: "Active Task",
              description: null,
              dueDate: null,
              isCompleted: false,
              completedAt: null,
              dayOrder: 1,
              listId: "l1",
              originalDepth: 0,
            },
            {
              id: "t2",
              tempId: "tmp2",
              parentId: null,
              tempParentId: null,
              content: "Done Task",
              description: null,
              dueDate: null,
              isCompleted: true,
              completedAt: "2026-11-20T10:00:00.000Z",
              dayOrder: 2,
              listId: "l1",
              originalDepth: 0,
            },
          ],
          duplicatesSkipped: 0,
          parentRedirects: {},
          subtasksReassigned: 0,
        },
      ],
      totalTasks: 2,
      rootTasksCount: 2,
      subtasksCount: 0,
      earliestDate: null,
      latestDate: null,
      newProjectCount: 1,
      mergedProjectCount: 0,
      duplicateTasksSkipped: 0,
      subtasksReassigned: 0,
      rawSource: { lists: [], tasksByListId: {} },
    };

    const onOpenChange = vi.fn();
    render(<AppMigrationDialog open onOpenChange={onOpenChange} />);

    // Initially includes completed tasks (total 2)
    const commitBtn = screen.getByRole("button", {
      name: "Import 2 tasks",
    });
    expect(commitBtn).toBeInTheDocument();

    // Toggle include completed checkbox
    const checkbox = screen.getByRole("checkbox", {
      name: /include completed tasks/i,
    });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    // Button label reflects active-only tasks (1 task)
    const updatedCommitBtn = screen.getByRole("button", {
      name: "Import 1 tasks",
    });
    expect(updatedCommitBtn).toBeInTheDocument();

    fireEvent.click(updatedCommitBtn);
    expect(commitGoogleTasksImportMock).toHaveBeenCalledWith(undefined, {
      includeCompleted: false,
    });

    // Test Cancel button calls cancelGoogleTasksImportMock
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);
    expect(cancelGoogleTasksImportMock).toHaveBeenCalled();
  });
});
