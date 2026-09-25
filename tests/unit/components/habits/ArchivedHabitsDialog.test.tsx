/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArchivedHabitsDialog } from "@/components/habits/ArchivedHabitsDialog";

const restore = vi.fn();
const remove = vi.fn();
let archived: any[] = [];

vi.mock("@/lib/hooks/useHabits", () => ({
  useArchivedHabits: () => ({ data: archived, isLoading: false }),
}));
vi.mock("@/lib/hooks/useHabitMutations", () => ({
  useUnarchiveHabit: () => ({ mutate: restore, isPending: false }),
  useDeleteHabit: () => ({ mutate: remove, isPending: false }),
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

describe("ArchivedHabitsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    archived = [
      { id: "h1", name: "Read", color: "#ff0000", icon: "Book" },
      { id: "h2", name: "Run", color: "#00ff00", icon: null },
    ];
  });

  it("lists archived habits by name", () => {
    render(<ArchivedHabitsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it("restores a habit", () => {
    render(<ArchivedHabitsDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getAllByText("Restore")[0]);
    expect(restore).toHaveBeenCalledWith("h1");
  });

  it("deletes a habit only after confirmation", () => {
    render(<ArchivedHabitsDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Delete Run"));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("confirm-delete"));
    expect(remove).toHaveBeenCalledWith("h2");
  });

  it("shows an empty state", () => {
    archived = [];
    render(<ArchivedHabitsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText("No archived habits")).toBeInTheDocument();
  });
});
