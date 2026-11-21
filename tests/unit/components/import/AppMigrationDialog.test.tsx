import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppMigrationDialog } from "@/components/settings/AppMigrationDialog";
import type { MicrosoftTasksImportPreview } from "@/lib/import/microsoft-tasks/types";

const mockPrepareMicrosoftOAuthImport = vi.fn();
const mockPrepareMicrosoftFileImport = vi.fn();
const mockCommitMicrosoftTasksImport = vi.fn();
const mockCancelMicrosoftTasksImport = vi.fn();

let mockMicrosoftTasksPreview: MicrosoftTasksImportPreview | null = null;
let mockIsGuestMode = false;

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
