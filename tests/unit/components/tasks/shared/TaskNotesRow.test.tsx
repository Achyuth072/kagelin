import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskNotesRow } from "@/components/tasks/shared/TaskNotesRow";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

const baseProps = {
  description: "",
  setDescription: vi.fn(),
  isPreviewMode: true,
  setIsPreviewMode: vi.fn(),
  defaultPreviewOnOpen: true,
  open: false,
  onOpenChange: vi.fn(),
};

describe("TaskNotesRow", () => {
  it("shows Can't be read when the saved description is unreadable", () => {
    render(<TaskNotesRow {...baseProps} unreadable={true} />);

    expect(screen.getByTestId("unreadable-text")).toBeInTheDocument();
    expect(screen.queryByText(/Add details/)).not.toBeInTheDocument();
  });

  it("shows the add-details prompt when the description is empty", () => {
    render(<TaskNotesRow {...baseProps} unreadable={false} />);

    expect(screen.getByText(/Add details/)).toBeInTheDocument();
    expect(screen.queryByTestId("unreadable-text")).not.toBeInTheDocument();
  });
});
