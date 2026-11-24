import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TickTickMigrationView } from "@/components/import/TickTickMigrationView";
import type { TickTickImportPreview } from "@/lib/import/ticktick/types";

describe("TickTickMigrationView", () => {
  const mockPreview: TickTickImportPreview = {
    totalTasks: 5,
    rootTasksCount: 3,
    subtasksCount: 2,
    completedTasksCount: 2,
    recurringCount: 1,
    earliestDate: "2026-11-20T00:00:00.000Z",
    latestDate: "2026-11-25T00:00:00.000Z",
    projects: [
      {
        name: "Inbox",
        folderName: null,
        status: "inbox",
        isInbox: true,
        existingProjectId: null,
        color: "#3b82f6",
        tasks: [],
        duplicatesSkipped: 0,
        parentRedirects: {},
        subtasksReassigned: 0,
      },
      {
        name: "Work / Launch",
        folderName: "Work",
        status: "new",
        isInbox: false,
        existingProjectId: null,
        color: "#10b981",
        tasks: [],
        duplicatesSkipped: 1,
        parentRedirects: {},
        subtasksReassigned: 1,
      },
    ],
    parentRedirects: {},
    duplicateTasksSkipped: 1,
    subtasksReassigned: 1,
    newProjectCount: 1,
    mergedProjectCount: 0,
    isQuotaLimited: false,
  };

  it("renders preview metrics and detected projects", () => {
    render(
      <TickTickMigrationView
        preview={mockPreview}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Confirm TickTick Import")).toBeInTheDocument();
    expect(screen.getByText("Total tasks found")).toBeInTheDocument();
    expect(screen.getByText("Top-level tasks")).toBeInTheDocument();
    expect(screen.getByText("Steps")).toBeInTheDocument();
    expect(screen.getByText("Recurring tasks")).toBeInTheDocument();
    expect(screen.getByText("Completed tasks")).toBeInTheDocument();
    expect(screen.getByText("Duplicates skipped")).toBeInTheDocument();
    expect(
      screen.getByText("Steps re-attached to existing tasks"),
    ).toBeInTheDocument();
    expect(screen.getByText("Work / Launch")).toBeInTheDocument();
  });

  it("toggles includeCompleted checkbox and recalculates importable task count", () => {
    const onIncludeCompletedChange = vi.fn();
    render(
      <TickTickMigrationView
        preview={mockPreview}
        includeCompleted={true}
        onIncludeCompletedChange={onIncludeCompletedChange}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Import 5 tasks" }),
    ).toBeInTheDocument();

    const checkbox = screen.getByLabelText(/Include completed tasks/);
    fireEvent.click(checkbox);

    expect(onIncludeCompletedChange).toHaveBeenCalledWith(false);
  });

  it("calls onCommit and onCancel callbacks", () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    render(
      <TickTickMigrationView
        preview={mockPreview}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Import \d+ tasks/ }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
