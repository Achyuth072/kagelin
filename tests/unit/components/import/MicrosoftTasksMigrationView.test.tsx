import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MicrosoftTasksMigrationView } from "@/components/import/MicrosoftTasksMigrationView";
import type { MicrosoftTasksImportPreview } from "@/lib/import/microsoft-tasks/types";

const mockPrepareOAuthImport = vi.fn();
const mockPrepareFileImport = vi.fn();
const mockCommitImport = vi.fn();
const mockCancelImport = vi.fn();

vi.mock("@/lib/hooks/useMicrosoftTasksImport", () => ({
  useMicrosoftTasksImport: () => ({
    prepareOAuthImport: mockPrepareOAuthImport,
    prepareFileImport: mockPrepareFileImport,
    commitImport: mockCommitImport,
    cancelImport: mockCancelImport,
    preview: null,
    state: "idle",
    isImporting: false,
    error: null,
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false, user: { id: "user-123" } }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("MicrosoftTasksMigrationView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const samplePreview: MicrosoftTasksImportPreview = {
    kind: "microsoft-tasks",
    projects: [
      {
        listId: "list-1",
        name: "Shopping",
        isInbox: false,
        action: "create",
        status: "new",
        existingProjectId: null,
        color: "#0078D4",
        tasks: [
          {
            id: "t1",
            tempId: "temp-1",
            parentId: null,
            tempParentId: null,
            content: "Buy groceries",
            description: null,
            dueDate: "2026-11-25T00:00:00.000Z",
            isCompleted: false,
            completedAt: null,
            priority: 2,
            dayOrder: 1,
            listId: "list-1",
          },
          {
            id: "s1",
            tempId: "temp-s1",
            parentId: "t1",
            tempParentId: "temp-1",
            content: "Apples",
            description: null,
            dueDate: null,
            isCompleted: true,
            completedAt: "2026-11-21T00:00:00.000Z",
            priority: 4,
            dayOrder: 2,
            listId: "list-1",
          },
        ],
        duplicatesSkipped: 2,
        parentRedirects: {},
        subtasksReassigned: 0,
      },
    ],
    tasks: [],
    totalLists: 1,
    totalTasks: 2,
    totalCompleted: 1,
    duplicatesCount: 2,
    rootTasksCount: 1,
    subtasksCount: 1,
    earliestDate: "2026-11-25T00:00:00.000Z",
    latestDate: "2026-11-25T00:00:00.000Z",
    newProjectCount: 1,
    mergedProjectCount: 0,
    subtasksReassigned: 0,
  };

  describe("Drill-down Subview (Ingress options)", () => {
    it("renders back button and triggers onBack callback", () => {
      const onBack = vi.fn();
      render(<MicrosoftTasksMigrationView onBack={onBack} />);

      const backBtn = screen.getByRole("button", { name: /back to all apps/i });
      expect(backBtn).toBeInTheDocument();
      fireEvent.click(backBtn);
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("renders 1-Click Connect & Import button for registered users", () => {
      const onConnectOAuth = vi.fn();
      render(
        <MicrosoftTasksMigrationView
          onConnectOAuth={onConnectOAuth}
          isGuestMode={false}
        />,
      );

      const connectCard = screen.getByRole("button", {
        name: "Connect Microsoft To Do",
      });
      expect(connectCard).toBeInTheDocument();
      expect(screen.getByText("Connect Microsoft Account")).toBeInTheDocument();
      expect(
        screen.getByText("1-Click Direct OAuth automated sync"),
      ).toBeInTheDocument();

      fireEvent.click(connectCard);
      expect(onConnectOAuth).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(connectCard, { key: "Enter" });
      expect(onConnectOAuth).toHaveBeenCalledTimes(2);

      fireEvent.keyDown(connectCard, { key: " " });
      expect(onConnectOAuth).toHaveBeenCalledTimes(3);
    });

    it("hides OAuth connect button in guest mode", () => {
      render(<MicrosoftTasksMigrationView isGuestMode={true} />);
      expect(
        screen.queryByRole("button", { name: "Connect Microsoft To Do" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Import Microsoft Tasks JSON or Outlook CSV file",
        }),
      ).toBeInTheDocument();
    });

    it("renders file drop zone with clear disclosure about CSV checklist steps", () => {
      render(<MicrosoftTasksMigrationView />);

      const dropZone = screen.getByRole("button", {
        name: "Import Microsoft Tasks JSON or Outlook CSV file",
      });
      expect(dropZone.className).not.toContain("border-dashed");
      expect(dropZone.className).toContain("border-border/80");
      expect(dropZone.querySelector("svg")).toBeInTheDocument();

      expect(
        screen.getByText("File Upload (.json or .csv)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Note: Classic Outlook CSV exports do not contain checklist Steps. Use Microsoft Graph JSON for full fidelity checklist import./i,
        ),
      ).toBeInTheDocument();
    });

    it("handles drag and drop for .json and .csv files", async () => {
      const onFileSelect = vi.fn();
      render(<MicrosoftTasksMigrationView onFileSelect={onFileSelect} />);

      const dropZone = screen.getByRole("button", {
        name: "Import Microsoft Tasks JSON or Outlook CSV file",
      });

      // Drag over and leave styling
      fireEvent.dragOver(dropZone);
      expect(dropZone.className).toContain("border-brand");

      fireEvent.dragLeave(dropZone);
      expect(dropZone.className).not.toContain("border-brand");

      // Drop JSON file
      const jsonFile = new File(['{"lists":[]}'], "todo.json", {
        type: "application/json",
      });
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [jsonFile] },
      });
      expect(onFileSelect).toHaveBeenCalledWith(jsonFile);

      // Drop CSV file
      const csvFile = new File(
        ["Subject,Status\nTask 1,Completed"],
        "tasks.csv",
        { type: "text/csv" },
      );
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [csvFile] },
      });
      expect(onFileSelect).toHaveBeenCalledWith(csvFile);
    });

    it("triggers file input on click and keyboard activation", () => {
      render(<MicrosoftTasksMigrationView />);

      const fileInput = screen.getByLabelText("Upload Microsoft Tasks file");
      const clickSpy = vi.spyOn(fileInput, "click");

      const dropZone = screen.getByRole("button", {
        name: "Import Microsoft Tasks JSON or Outlook CSV file",
      });

      fireEvent.click(dropZone);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(dropZone, { key: "Enter" });
      expect(clickSpy).toHaveBeenCalledTimes(2);

      fireEvent.keyDown(dropZone, { key: " " });
      expect(clickSpy).toHaveBeenCalledTimes(3);
    });

    it("processes file selection from file input change event", () => {
      const onFileSelect = vi.fn();
      render(<MicrosoftTasksMigrationView onFileSelect={onFileSelect} />);

      const fileInput = screen.getByLabelText(
        "Upload Microsoft Tasks file",
      ) as HTMLInputElement;
      const file = new File(['{"lists":[]}'], "backup.json", {
        type: "application/json",
      });

      fireEvent.change(fileInput, { target: { files: [file] } });
      expect(onFileSelect).toHaveBeenCalledWith(file);
    });
  });

  describe("Interactive Preview Screen", () => {
    it("renders metric chips: Total Lists, Total Tasks, Total Steps, Completed, Skipped Duplicates", () => {
      render(<MicrosoftTasksMigrationView preview={samplePreview} />);

      expect(
        screen.getByText("Confirm Microsoft To Do Import"),
      ).toBeInTheDocument();
      expect(screen.getByText("Total Lists")).toBeInTheDocument();
      expect(screen.getByText("Total Tasks")).toBeInTheDocument();
      expect(screen.getByText("Total Steps")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Skipped Duplicates")).toBeInTheDocument();

      // Check values
      expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1); // totalLists & totalSteps
      expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1); // totalTasks & duplicates
    });

    it("renders scroll-contained list of projects, tasks, and steps", () => {
      render(<MicrosoftTasksMigrationView preview={samplePreview} />);

      expect(screen.getByText("Shopping")).toBeInTheDocument();
      expect(screen.getByText("New")).toBeInTheDocument();
      expect(screen.getByText("Buy groceries")).toBeInTheDocument();
      expect(screen.getByText("Apples")).toBeInTheDocument();
    });

    it("toggles include completed tasks checkbox and updates commit button label", () => {
      const onCommit = vi.fn();
      render(
        <MicrosoftTasksMigrationView
          preview={samplePreview}
          onCommit={onCommit}
        />,
      );

      const commitButton = screen.getByRole("button", {
        name: "Import 2 tasks",
      });
      expect(commitButton).toBeInTheDocument();

      const checkbox = screen.getByRole("checkbox", {
        name: /include completed tasks/i,
      });
      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();

      // Active only: 2 total - 1 completed = 1 task
      const updatedCommitButton = screen.getByRole("button", {
        name: "Import 1 tasks",
      });
      expect(updatedCommitButton).toBeInTheDocument();

      fireEvent.click(updatedCommitButton);
      expect(onCommit).toHaveBeenCalledWith({ includeCompleted: false });
    });

    it("triggers onCancel when Cancel button is clicked", () => {
      const onCancel = vi.fn();
      render(
        <MicrosoftTasksMigrationView
          preview={samplePreview}
          onCancel={onCancel}
        />,
      );

      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("renders progress indicator during isImporting without layout shift", () => {
      render(
        <MicrosoftTasksMigrationView
          preview={samplePreview}
          isImporting={true}
        />,
      );

      const progress = screen.getByRole("progressbar", {
        name: "Importing tasks",
      });
      expect(progress).toBeInTheDocument();
      expect(
        screen.getByText("Importing records in chunks of 100..."),
      ).toBeInTheDocument();

      const commitButton = screen.getByRole("button", { name: "" }); // spinner only
      expect(commitButton).toBeDisabled();
    });
  });
});
