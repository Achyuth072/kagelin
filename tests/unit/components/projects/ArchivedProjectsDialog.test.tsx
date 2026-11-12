/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArchivedProjectsDialog } from "@/components/projects/ArchivedProjectsDialog";

const restore = vi.fn();
const remove = vi.fn();
let archived: any[] = [];

vi.mock("@/lib/hooks/useProjects", () => ({
  useArchivedProjects: () => ({ data: archived, isLoading: false }),
}));
vi.mock("@/lib/hooks/useProjectMutations", () => ({
  useUnarchiveProject: () => ({ mutate: restore, isPending: false }),
  useHardDeleteProject: () => ({ mutate: remove, isPending: false }),
}));
vi.mock("@/components/ui/responsive-dialog", () => {
  const P = ({ children }: any) => <div>{children}</div>;
  return {
    ResponsiveDialog: ({ open, children }: any) =>
      open ? <div>{children}</div> : null,
    ResponsiveDialogContent: P,
    ResponsiveDialogHeader: P,
    ResponsiveDialogTitle: P,
    ResponsiveDialogDescription: P,
  };
});
vi.mock("@/components/ui/DeleteConfirmationDialog", () => ({
  DeleteConfirmationDialog: ({ isOpen, onConfirm }: any) =>
    isOpen ? <button onClick={onConfirm}>confirm-delete</button> : null,
}));

describe("ArchivedProjectsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    archived = [
      { id: "p1", name: "Work", color: "#4B6CB7" },
      { id: "p2", name: "Home", color: "#2E2E2E" },
    ];
  });

  it("lists archived projects by name", () => {
    render(<ArchivedProjectsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("restores a project", () => {
    render(<ArchivedProjectsDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getAllByText("Restore")[0]);
    expect(restore).toHaveBeenCalledWith("p1");
  });

  it("deletes a project only after confirmation", () => {
    render(<ArchivedProjectsDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Delete Home"));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("confirm-delete"));
    expect(remove).toHaveBeenCalledWith("p2");
  });

  it("shows an empty state when no projects archived", () => {
    archived = [];
    render(<ArchivedProjectsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText("No archived projects")).toBeInTheDocument();
  });
});
