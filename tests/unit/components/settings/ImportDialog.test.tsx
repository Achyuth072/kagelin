import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ImportDialog } from "@/components/settings/ImportDialog";
import type { IcsImportPreview } from "@/lib/hooks/useIcsImport";
import type { TodoistPreview } from "@/lib/hooks/useTodoistImport";

const {
  prepareImportMock,
  commitImportMock,
  cancelImportMock,
  prepareTodoistImportMock,
  commitTodoistImportMock,
  cancelTodoistImportMock,
} = vi.hoisted(() => ({
  prepareImportMock: vi.fn(),
  commitImportMock: vi.fn(),
  cancelImportMock: vi.fn(),
  prepareTodoistImportMock: vi.fn(),
  commitTodoistImportMock: vi.fn(),
  cancelTodoistImportMock: vi.fn(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
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

function makePreview(
  overrides: Partial<IcsImportPreview> = {},
): IcsImportPreview {
  return {
    toCreate: [],
    totalParsed: 0,
    duplicateCount: 0,
    earliest: null,
    latest: null,
    parseErrors: [],
    ...overrides,
  };
}

describe("ImportDialog — ICS confirmation step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commitImportMock.mockResolvedValue(true);
  });

  it("commits immediately for a small import — no confirmation shown", async () => {
    prepareImportMock.mockResolvedValue(
      makePreview({ toCreate: [{}] as never, totalParsed: 1 }),
    );
    const onOpenChange = vi.fn();
    render(<ImportDialog open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText("Upload iCalendar ICS file"), {
      target: { files: [new File(["x"], "small.ics")] },
    });

    await waitFor(() => expect(commitImportMock).toHaveBeenCalled());
    expect(screen.queryByText("Confirm Import")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a confirmation step for a large import and waits for the user", async () => {
    const bigToCreate = Array.from({ length: 60 }, () => ({}) as never);
    prepareImportMock.mockResolvedValue(
      makePreview({
        toCreate: bigToCreate,
        totalParsed: 63,
        duplicateCount: 3,
      }),
    );
    render(<ImportDialog open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Upload iCalendar ICS file"), {
      target: { files: [new File(["x"], "big.ics")] },
    });

    await screen.findByText("Confirm Import");
    expect(commitImportMock).not.toHaveBeenCalled();
    expect(screen.getByText("63")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Import 60 events"));
    await waitFor(() => expect(commitImportMock).toHaveBeenCalled());
  });

  it("cancel on the confirmation step writes nothing", async () => {
    const bigToCreate = Array.from({ length: 60 }, () => ({}) as never);
    prepareImportMock.mockResolvedValue(
      makePreview({ toCreate: bigToCreate, totalParsed: 60 }),
    );
    render(<ImportDialog open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Upload iCalendar ICS file"), {
      target: { files: [new File(["x"], "big.ics")] },
    });
    await screen.findByText("Confirm Import");

    fireEvent.click(screen.getByText("Cancel"));
    expect(cancelImportMock).toHaveBeenCalled();
    expect(commitImportMock).not.toHaveBeenCalled();
  });

  describe("Todoist CSV import confirmation step", () => {
    it("shows confirmation preview dialog when Todoist CSV is selected", async () => {
      prepareTodoistImportMock.mockResolvedValue({
        tasks: [],
        totalTasks: 25,
        rootTasksCount: 20,
        subtasksCount: 5,
        recurringCount: 3,
        earliestDate: "2026-10-20T00:00:00.000Z",
        latestDate: "2026-10-30T00:00:00.000Z",
        rawSource: { meta: {}, rows: [] },
      });

      render(<ImportDialog open onOpenChange={vi.fn()} />);

      fireEvent.change(
        screen.getByLabelText("Upload Todoist CSV or ZIP backup file"),
        {
          target: {
            files: [new File(["TYPE,CONTENT\ntask,Test"], "Todoist.csv")],
          },
        },
      );

      await screen.findByText("Confirm Todoist Import");
      expect(screen.getByText("25")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Import 25 tasks"));
      await waitFor(() => expect(commitTodoistImportMock).toHaveBeenCalled());
    });

    it("canceling Todoist confirmation leaves workspace untouched", async () => {
      prepareTodoistImportMock.mockResolvedValue({
        tasks: [],
        totalTasks: 10,
        rootTasksCount: 10,
        subtasksCount: 0,
        recurringCount: 0,
        earliestDate: null,
        latestDate: null,
        rawSource: { meta: {}, rows: [] },
      });

      render(<ImportDialog open onOpenChange={vi.fn()} />);

      fireEvent.change(
        screen.getByLabelText("Upload Todoist CSV or ZIP backup file"),
        {
          target: {
            files: [new File(["TYPE,CONTENT\ntask,Test"], "Todoist.csv")],
          },
        },
      );

      await screen.findByText("Confirm Todoist Import");

      fireEvent.click(screen.getByText("Cancel"));
      expect(cancelTodoistImportMock).toHaveBeenCalled();
      expect(commitTodoistImportMock).not.toHaveBeenCalled();
    });

    it("supports dropping a CSV file directly onto the Todoist card", async () => {
      prepareTodoistImportMock.mockResolvedValue({
        tasks: [],
        totalTasks: 5,
        rootTasksCount: 5,
        subtasksCount: 0,
        recurringCount: 0,
        earliestDate: null,
        latestDate: null,
        rawSource: { meta: {}, rows: [] },
      });

      render(<ImportDialog open onOpenChange={vi.fn()} />);

      const dropCard = screen.getByText("Todoist").closest(".cursor-pointer");
      expect(dropCard).not.toBeNull();

      fireEvent.drop(dropCard!, {
        dataTransfer: {
          files: [new File(["TYPE,CONTENT\ntask,Test"], "Todoist.csv")],
        },
      });

      await screen.findByText("Confirm Todoist Import");
      expect(prepareTodoistImportMock).toHaveBeenCalled();
    });

    it("shows a project breakdown for a ZIP backup preview", async () => {
      const project = (name: string, status: "new" | "merged" | "inbox") => ({
        name,
        isInbox: status === "inbox",
        status,
        viewStyle: "list" as const,
        color: "#4B6CB7",
        existingProjectId: status === "merged" ? "p-1" : null,
        tasks: [],
        duplicatesSkipped: 0,
      });

      prepareTodoistImportMock.mockResolvedValue({
        projects: [
          project("Alpha", "new"),
          project("Beta", "new"),
          project("Gamma", "merged"),
        ],
        totalTasks: 40,
        rootTasksCount: 35,
        subtasksCount: 5,
        recurringCount: 0,
        earliestDate: null,
        latestDate: null,
        newProjectCount: 2,
        mergedProjectCount: 1,
        duplicateTasksSkipped: 7,
        rawSource: { files: [] },
      });

      render(<ImportDialog open onOpenChange={vi.fn()} />);

      fireEvent.change(
        screen.getByLabelText("Upload Todoist CSV or ZIP backup file"),
        {
          target: { files: [new File(["PK"], "Todoist-backup.zip")] },
        },
      );

      await screen.findByText("Confirm Todoist Import");
      expect(screen.getByText("Projects detected")).toBeInTheDocument();
      expect(screen.getByText("New projects")).toBeInTheDocument();
      expect(screen.getByText("Merged into existing")).toBeInTheDocument();
      expect(screen.getByText("Duplicates skipped")).toBeInTheDocument();
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("Detected projects")).toBeInTheDocument();
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Beta")).toBeInTheDocument();
      expect(screen.getByText("Gamma")).toBeInTheDocument();
    });
  });
});
