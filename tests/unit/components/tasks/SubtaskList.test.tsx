import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import SubtaskList from "@/components/tasks/SubtaskList";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: true, user: { id: "user-123" } })),
}));

function renderDraftSubtaskList() {
  const queryClient = new QueryClient();

  function Wrapper() {
    const [draftSubtasks, setDraftSubtasks] = useState<string[]>([]);
    return (
      <SubtaskList
        projectId={null}
        draftSubtasks={draftSubtasks}
        onDraftSubtasksChange={setDraftSubtasks}
      />
    );
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <Wrapper />
    </QueryClientProvider>,
  );
}

describe("SubtaskList - create view Enter-key flow", () => {
  it("stays visible after adding a subtask, so more can be added without re-opening anything", () => {
    renderDraftSubtaskList();

    const input = screen.getByPlaceholderText("Add a step...");
    fireEvent.change(input, { target: { value: "First step" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("First step")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add a step...")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Second step" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("First step")).toBeInTheDocument();
    expect(screen.getByText("Second step")).toBeInTheDocument();
  });
});

describe("SubtaskList - add-step button", () => {
  it("clicking the Plus icon submits the input, same as pressing Enter", () => {
    renderDraftSubtaskList();

    const input = screen.getByPlaceholderText("Add a step...");
    const addButton = screen.getByRole("button", { name: "Add step" });

    expect(addButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "First step" } });
    expect(addButton).toBeEnabled();

    fireEvent.click(addButton);

    expect(screen.getByText("First step")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });
});

describe("SubtaskList - mobile delete affordance", () => {
  it("is visible by default and only hover-gated at desktop widths", () => {
    renderDraftSubtaskList();

    const input = screen.getByPlaceholderText("Add a step...");
    fireEvent.change(input, { target: { value: "First step" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const deleteButton = screen.getByRole("button", {
      name: "Delete subtask",
    });
    expect(deleteButton).toHaveClass("opacity-100");
    expect(deleteButton).toHaveClass("md:opacity-0");
    expect(deleteButton).toHaveClass("md:group-hover:opacity-100");
    expect(deleteButton.className).not.toMatch(/(?<!md:)group-hover:opacity/);

    expect(deleteButton).toHaveClass("text-destructive");
    expect(deleteButton).toHaveClass("md:text-muted-foreground");
  });
});

describe("SubtaskList - step input shortcut bubbling", () => {
  it("does not intercept Ctrl+Enter or Cmd+Enter so it bubbles to parent task save", () => {
    renderDraftSubtaskList();

    const input = screen.getByPlaceholderText("Add a step...");
    fireEvent.change(input, { target: { value: "Uncommitted step" } });

    const notPreventedMeta = fireEvent.keyDown(input, {
      key: "Enter",
      metaKey: true,
    });
    expect(notPreventedMeta).toBe(true);

    const notPreventedCtrl = fireEvent.keyDown(input, {
      key: "Enter",
      ctrlKey: true,
    });
    expect(notPreventedCtrl).toBe(true);

    // It should not have been committed into the list as a standalone subtask yet
    expect(screen.queryByText("Uncommitted step")).toBeNull();
    expect(input).toHaveValue("Uncommitted step");
  });

  it("supports controlled pendingContent and onPendingContentChange", () => {
    const onPendingContentChange = vi.fn();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SubtaskList
          projectId={null}
          draftSubtasks={[]}
          pendingContent="Controlled step text"
          onPendingContentChange={onPendingContentChange}
        />
      </QueryClientProvider>,
    );

    const input = screen.getByPlaceholderText("Add a step...");
    expect(input).toHaveValue("Controlled step text");

    fireEvent.change(input, { target: { value: "New step text" } });
    expect(onPendingContentChange).toHaveBeenCalledWith("New step text");
  });
});
