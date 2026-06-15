import type React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskNotesEditor } from "@/components/tasks/shared/TaskNotesEditor";

vi.mock("@/components/ui/responsive-dialog", () => ({
  ResponsiveDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
  }) => (open ? <div>{children}</div> : null),
  ResponsiveDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResponsiveDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ResponsiveDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  ResponsiveDialogDescription: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <p>{children}</p>,
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("TaskNotesEditor", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    description: "Hello world",
    setDescription: vi.fn(),
    isPreviewMode: false,
    setIsPreviewMode: vi.fn(),
  };

  it("renders the description in an editable textarea and propagates edits", () => {
    render(<TaskNotesEditor {...defaultProps} />);

    const textarea = screen.getByRole("textbox", { name: /notes/i });
    expect(textarea).toHaveValue("Hello world");

    fireEvent.change(textarea, { target: { value: "Hello world!" } });
    expect(defaultProps.setDescription).toHaveBeenCalledWith("Hello world!");
  });

  it("does not render when closed", () => {
    render(<TaskNotesEditor {...defaultProps} open={false} />);
    expect(screen.queryByRole("textbox", { name: /notes/i })).toBeNull();
  });

  it("renders markdown preview instead of the textarea in preview mode", () => {
    render(
      <TaskNotesEditor
        {...defaultProps}
        description="# Heading"
        isPreviewMode={true}
      />,
    );

    expect(screen.queryByRole("textbox", { name: /notes/i })).toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: "Heading" }),
    ).toBeInTheDocument();
  });

  it("toggles preview mode via the Preview/Edit button", () => {
    render(<TaskNotesEditor {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));

    expect(defaultProps.setIsPreviewMode).toHaveBeenCalledTimes(1);
    const updater = defaultProps.setIsPreviewMode.mock.calls[0][0];
    expect(updater(false)).toBe(true);
  });

  it("allows switching back to preview from edit mode even when the description is empty", () => {
    render(
      <TaskNotesEditor
        {...defaultProps}
        description=""
        isPreviewMode={false}
      />,
    );

    const previewButton = screen.getByRole("button", { name: /preview/i });
    expect(previewButton).not.toBeDisabled();

    fireEvent.click(previewButton);

    expect(defaultProps.setIsPreviewMode).toHaveBeenCalledTimes(1);
    const updater = defaultProps.setIsPreviewMode.mock.calls[0][0];
    expect(updater(false)).toBe(true);
  });

  it("wraps the selected text in ** when the Bold toolbar button is clicked", () => {
    render(<TaskNotesEditor {...defaultProps} />);

    const textarea = screen.getByRole("textbox", {
      name: /notes/i,
    }) as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 5);

    fireEvent.click(screen.getByRole("button", { name: /bold/i }));

    expect(defaultProps.setDescription).toHaveBeenCalledWith("**Hello** world");
  });
});
