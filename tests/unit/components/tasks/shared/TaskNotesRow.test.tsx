import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskNotesRow } from "@/components/tasks/shared/TaskNotesRow";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("TaskNotesRow", () => {
  it("shows Can't be read when the saved description is unreadable", () => {
    render(
      <TaskNotesRow
        description=""
        setDescription={vi.fn()}
        unreadable={true}
      />,
    );

    expect(screen.getByTestId("unreadable-text")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Add notes")).not.toBeInTheDocument();
  });

  it("shows the textarea with Add notes placeholder when description is empty", () => {
    render(
      <TaskNotesRow
        description=""
        setDescription={vi.fn()}
        unreadable={false}
      />,
    );

    expect(screen.getByPlaceholderText("Add notes")).toBeInTheDocument();
    expect(screen.queryByTestId("unreadable-text")).not.toBeInTheDocument();
  });

  it("renders non-empty description as formatted text with clickable raw URLs", () => {
    render(
      <TaskNotesRow
        description="Check out https://kagelin.app for details."
        setDescription={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "https://kagelin.app" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://kagelin.app");
    const editButton = screen.getByRole("button", { name: "Edit notes" });
    expect(editButton).toBeInTheDocument();
    expect(editButton).toHaveTextContent("Check out");
    expect(editButton).toHaveTextContent("for details.");
  });

  it("renders markdown links with custom labels", () => {
    render(
      <TaskNotesRow
        description="Read the [documentation](https://kagelin.app/docs) here."
        setDescription={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "documentation" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://kagelin.app/docs");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("switches to textarea when clicking the notes text and propagates changes", () => {
    const setDescription = vi.fn();
    render(
      <TaskNotesRow
        description="Original note text"
        setDescription={setDescription}
      />,
    );

    const readView = screen.getByRole("button", { name: /notes/i });
    expect(readView).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /notes/i })).toBeNull();

    fireEvent.click(readView);

    const textarea = screen.getByRole("textbox", { name: /notes/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Original note text");

    fireEvent.change(textarea, { target: { value: "Updated note text" } });
    expect(setDescription).toHaveBeenCalledWith("Updated note text");
  });

  it("trims trailing punctuation from raw URLs and preserves it as plain text", () => {
    render(
      <TaskNotesRow
        description="Visit https://kagelin.app."
        setDescription={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "https://kagelin.app" });
    expect(link).toHaveAttribute("href", "https://kagelin.app");
    const editButton = screen.getByRole("button", { name: "Edit notes" });
    expect(editButton).toHaveTextContent("Visit https://kagelin.app.");
  });

  it("activates editing via keyboard Enter on the notes button", () => {
    render(
      <TaskNotesRow
        description="Keyboard accessible notes"
        setDescription={vi.fn()}
      />,
    );

    const readView = screen.getByRole("button", { name: /notes/i });
    fireEvent.keyDown(readView, { key: "Enter" });

    expect(screen.getByRole("textbox", { name: /notes/i })).toBeInTheDocument();
  });
});
