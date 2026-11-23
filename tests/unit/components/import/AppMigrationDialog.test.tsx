import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppMigrationDialog } from "@/components/settings/AppMigrationDialog";
import type { MicrosoftTasksImportPreview } from "@/lib/import/microsoft-tasks/types";
import type { TickTickImportPreview } from "@/lib/import/ticktick/types";

const mockPrepareMicrosoftOAuthImport = vi.fn();
const mockPrepareMicrosoftFileImport = vi.fn();
const mockCommitMicrosoftTasksImport = vi.fn();
const mockCancelMicrosoftTasksImport = vi.fn();

let mockMicrosoftTasksPreview: MicrosoftTasksImportPreview | null = null;
let mockIsGuestMode = false;

const mockPrepareTickTickImport = vi.fn();
const mockCommitTickTickImport = vi.fn();
const mockCancelTickTickImport = vi.fn();
let mockTickTickPreview: TickTickImportPreview | null = null;
let mockIsImportingTickTick = false;

vi.mock("@/lib/hooks/useTickTickImport", () => ({
  useTickTickImport: () => ({
    prepareImport: mockPrepareTickTickImport,
    commitImport: mockCommitTickTickImport,
    cancelImport: mockCancelTickTickImport,
    preview: mockTickTickPreview,
    state: "idle",
    isImporting: mockIsImportingTickTick,
    error: null,
  }),
}));

vi.mock("@/lib/hooks/useMicrosoftTasksImport", () => ({
  useMicrosoftTasksImport: () => ({
    prepareOAuthImport: mockPrepareMicrosoftOAuthImport,
    prepareFileImport: mockPrepareMicrosoftFileImport,
    commitImport: mockCommitMicrosoftTasksImport,
    cancelImport: mockCancelMicrosoftTasksImport,
    preview: mockMicrosoftTasksPreview,
    state: "idle",
    isImporting: false,
    error: null,
  }),
}));

vi.mock("@/lib/hooks/useGoogleTasksImport", () => ({
  useGoogleTasksImport: () => ({
    prepareOAuthImport: vi.fn(),
    prepareTakeoutImport: vi.fn(),
    commitImport: vi.fn(),
    cancelImport: vi.fn(),
    preview: null,
    state: "idle",
    isImporting: false,
  }),
}));

vi.mock("@/lib/hooks/useTodoistImport", () => ({
  useTodoistImport: () => ({
    prepareImport: vi.fn(),
    commitImport: vi.fn(),
    cancelImport: vi.fn(),
    preview: null,
    isImporting: false,
  }),
}));

vi.mock("@/lib/hooks/useIcsImport", () => ({
  useIcsImport: () => ({
    prepareImport: vi.fn(),
    commitImport: vi.fn(),
    cancelImport: vi.fn(),
    preview: null,
    isImporting: false,
  }),
}));

vi.mock("@/lib/hooks/useUhabitsImport", () => ({
  useUhabitsImport: () => ({
    importUhabits: vi.fn(),
    isImporting: false,
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: mockIsGuestMode, user: { id: "test-user" } }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("AppMigrationDialog (Microsoft To Do Integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMicrosoftTasksPreview = null;
    mockIsGuestMode = false;
    mockCommitMicrosoftTasksImport.mockResolvedValue(true);
  });

  it("displays Microsoft To Do tile in main migration sources", () => {
    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByText("Microsoft To Do")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Microsoft To Do import options" }),
    ).toBeInTheDocument();
  });

  it("drills down to MicrosoftTasksMigrationView when clicking tile", () => {
    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    const tile = screen.getByRole("button", {
      name: "Microsoft To Do import options",
    });
    fireEvent.click(tile);

    expect(screen.getByText("Microsoft To Do Import")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect Microsoft To Do" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Import Microsoft Tasks JSON or Outlook CSV file",
      }),
    ).toBeInTheDocument();

    // Clicking Back returns to main tiles
    const backBtn = screen.getByRole("button", { name: "Back to all apps" });
    fireEvent.click(backBtn);
    expect(
      screen.getByRole("button", { name: "Microsoft To Do import options" }),
    ).toBeInTheDocument();
  });

  it("opens preview modal when microsoftTasksPreview arrives and commits import", async () => {
    mockMicrosoftTasksPreview = {
      kind: "microsoft-tasks",
      projects: [
        {
          listId: "l1",
          name: "Project A",
          isInbox: false,
          action: "create",
          status: "new",
          existingProjectId: null,
          color: "#0078D4",
          tasks: [
            {
              id: "task-1",
              tempId: "tmp-1",
              parentId: null,
              tempParentId: null,
              content: "Sample Task",
              description: null,
              dueDate: null,
              isCompleted: false,
              completedAt: null,
              priority: 2,
              dayOrder: 1,
              listId: "l1",
            },
          ],
          duplicatesSkipped: 0,
          parentRedirects: {},
          subtasksReassigned: 0,
        },
      ],
      tasks: [],
      totalLists: 1,
      totalTasks: 1,
      totalCompleted: 0,
      duplicatesCount: 0,
      rootTasksCount: 1,
      subtasksCount: 0,
      earliestDate: null,
      latestDate: null,
      newProjectCount: 1,
      mergedProjectCount: 0,
      subtasksReassigned: 0,
    };

    const onOpenChange = vi.fn();
    render(<AppMigrationDialog open onOpenChange={onOpenChange} />);

    expect(
      screen.getByText("Confirm Microsoft To Do Import"),
    ).toBeInTheDocument();
    expect(screen.getByText("Total Lists")).toBeInTheDocument();
    expect(screen.getByText("Total Tasks")).toBeInTheDocument();

    const commitBtn = screen.getByRole("button", { name: "Import 1 tasks" });
    fireEvent.click(commitBtn);
    expect(mockCommitMicrosoftTasksImport).toHaveBeenCalledWith(
      mockMicrosoftTasksPreview,
      { includeCompleted: true },
    );
  });
});

describe("AppMigrationDialog (TickTick Integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMicrosoftTasksPreview = null;
    mockTickTickPreview = null;
    mockIsImportingTickTick = false;
    mockCommitTickTickImport.mockResolvedValue(true);
  });

  it("displays TickTick tile in main migration sources with BetaBadge", () => {
    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByText("TickTick")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Import TickTick tasks from CSV",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Upload TickTick CSV file"),
    ).toBeInTheDocument();
  });

  it("calls prepareImport when a CSV file is selected", () => {
    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    const fileInput = screen.getByLabelText(
      "Upload TickTick CSV file",
    ) as HTMLInputElement;
    const testFile = new File(["dummy,csv"], "TickTickBackup.csv", {
      type: "text/csv",
    });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    expect(mockPrepareTickTickImport).toHaveBeenCalledWith(testFile);
  });

  it("renders drill-down preview with metrics and project breakdown", () => {
    mockTickTickPreview = {
      totalTasks: 17,
      rootTasksCount: 11,
      subtasksCount: 6,
      completedTasksCount: 4,
      recurringCount: 5,
      duplicateTasksSkipped: 3,
      subtasksReassigned: 1,
      newProjectCount: 1,
      mergedProjectCount: 1,
      earliestDate: "2026-11-20",
      latestDate: "2026-11-25",
      isQuotaLimited: false,
      parentRedirects: {},
      projects: [
        {
          name: "Inbox",
          folderName: null,
          status: "inbox",
          isInbox: true,
          existingProjectId: null,
          color: "#4772FA",
          tasks: [],
          duplicatesSkipped: 0,
          parentRedirects: {},
          subtasksReassigned: 0,
        },
        {
          name: "Personal",
          folderName: null,
          status: "new",
          isInbox: false,
          existingProjectId: null,
          color: "#4772FA",
          tasks: [],
          duplicatesSkipped: 1,
          parentRedirects: {},
          subtasksReassigned: 1,
        },
      ],
    };

    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByText("Confirm TickTick Import")).toBeInTheDocument();
    expect(screen.getByText("Total tasks found")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
    expect(screen.getByText("Top-level tasks")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("Steps")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("Recurring tasks")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Completed tasks")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Duplicates skipped")).toBeInTheDocument();
    expect(screen.getByText("Detected projects")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("updates importable count when include completed is toggled and commits import", () => {
    mockTickTickPreview = {
      totalTasks: 4,
      rootTasksCount: 3,
      subtasksCount: 1,
      completedTasksCount: 2,
      recurringCount: 0,
      duplicateTasksSkipped: 0,
      subtasksReassigned: 0,
      newProjectCount: 0,
      mergedProjectCount: 0,
      earliestDate: null,
      latestDate: null,
      isQuotaLimited: false,
      parentRedirects: {},
      projects: [],
    };

    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    const checkbox = screen.getByLabelText(
      /include completed tasks/i,
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    const importButton = screen.getByRole("button", { name: "Import 4 tasks" });
    expect(importButton).toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);

    const updatedImportButton = screen.getByRole("button", {
      name: "Import 2 tasks",
    });
    expect(updatedImportButton).toBeInTheDocument();

    fireEvent.click(updatedImportButton);
    expect(mockCommitTickTickImport).toHaveBeenCalledWith({
      includeCompleted: false,
    });
  });

  it("cancels TickTick import when Cancel button is clicked", () => {
    mockTickTickPreview = {
      totalTasks: 3,
      rootTasksCount: 3,
      subtasksCount: 0,
      completedTasksCount: 0,
      recurringCount: 0,
      duplicateTasksSkipped: 0,
      subtasksReassigned: 0,
      newProjectCount: 0,
      mergedProjectCount: 0,
      earliestDate: null,
      latestDate: null,
      isQuotaLimited: false,
      parentRedirects: {},
      projects: [],
    };

    render(<AppMigrationDialog open onOpenChange={vi.fn()} />);

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    expect(mockCancelTickTickImport).toHaveBeenCalled();
  });
});
