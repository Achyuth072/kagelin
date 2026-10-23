import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import {
  AppMigrationDialog,
  ImportDialog,
} from "@/components/settings/AppMigrationDialog";
import type { IcsImportPreview } from "@/lib/hooks/useIcsImport";
import type { TodoistPreview } from "@/lib/hooks/useTodoistImport";

const {
  triggerMock,
  prepareImportMock,
  commitImportMock,
  cancelImportMock,
  prepareTodoistImportMock,
  commitTodoistImportMock,
  cancelTodoistImportMock,
} = vi.hoisted(() => ({
  triggerMock: vi.fn(),
  prepareImportMock: vi.fn(),
  commitImportMock: vi.fn(),
  cancelImportMock: vi.fn(),
  prepareTodoistImportMock: vi.fn(),
  commitTodoistImportMock: vi.fn(),
  cancelTodoistImportMock: vi.fn(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: triggerMock }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false, user: { id: "test-user" } }),
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

describe("AppMigrationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commitImportMock.mockResolvedValue(true);
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
        name: "Export Loop Habit Tracker database",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Export Loop Habit Tracker CSV archive",
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

  it("handles dialog close via cancel button", () => {
    const onOpenChange = vi.fn();
    render(<AppMigrationDialog open onOpenChange={onOpenChange} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

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
});
