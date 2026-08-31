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

describe("SubtaskList - keyboard navigation contract", () => {
  it("commits on non-empty Enter and leaves blank focused input ready for next entry", () => {
    renderDraftSubtaskList();

    const input = screen.getByPlaceholderText("Add a step...");
    fireEvent.change(input, { target: { value: "Step 1" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(document.activeElement).toBe(input);
  });

  it("calls onCollapse when pressing Enter on an empty step input", () => {
    const onCollapse = vi.fn();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SubtaskList
          projectId={null}
          draftSubtasks={[]}
          onCollapse={onCollapse}
        />
      </QueryClientProvider>,
    );

    const input = screen.getByPlaceholderText("Add a step...");
    expect(input).toHaveValue("");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("deletes the last step and focuses previous step when Backspace is pressed on empty input", () => {
    const queryClient = new QueryClient();

    function Wrapper() {
      const [draftSubtasks, setDraftSubtasks] = useState<string[]>([
        "First step",
        "Second step",
      ]);
      return (
        <SubtaskList
          projectId={null}
          draftSubtasks={draftSubtasks}
          onDraftSubtasksChange={setDraftSubtasks}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <Wrapper />
      </QueryClientProvider>,
    );

    const input = screen.getByPlaceholderText("Add a step...");
    expect(input).toHaveValue("");

    // Press Backspace in the empty new step input
    fireEvent.keyDown(input, { key: "Backspace" });

    // Second step should be deleted, and First step should now be in edit mode
    expect(screen.queryByText("Second step")).toBeNull();
    const editInput = screen.getByLabelText("Edit step");
    expect(editInput).toBeInTheDocument();
    expect(editInput).toHaveValue("First step");
  });

  it("deletes the only step and leaves focus on new step input when Backspace is pressed on empty input", () => {
    const queryClient = new QueryClient();

    function Wrapper() {
      const [draftSubtasks, setDraftSubtasks] = useState<string[]>([
        "Only step",
      ]);
      return (
        <SubtaskList
          projectId={null}
          draftSubtasks={draftSubtasks}
          onDraftSubtasksChange={setDraftSubtasks}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <Wrapper />
      </QueryClientProvider>,
    );

    const input = screen.getByPlaceholderText("Add a step...");
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(screen.queryByText("Only step")).toBeNull();
    expect(screen.getByPlaceholderText("Add a step...")).toBeInTheDocument();
  });

  it("deletes step and focuses preceding step when Backspace is pressed on empty edit input", () => {
    const queryClient = new QueryClient();

    function Wrapper() {
      const [draftSubtasks, setDraftSubtasks] = useState<string[]>([
        "Step 1",
        "Step 2",
      ]);
      return (
        <SubtaskList
          projectId={null}
          draftSubtasks={draftSubtasks}
          onDraftSubtasksChange={setDraftSubtasks}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <Wrapper />
      </QueryClientProvider>,
    );

    // Click Step 2 to enter edit mode
    fireEvent.click(screen.getByText("Step 2"));
    const editInput = screen.getByLabelText("Edit step");
    expect(editInput).toHaveValue("Step 2");

    // Clear content and press Backspace
    fireEvent.change(editInput, { target: { value: "" } });
    fireEvent.keyDown(editInput, { key: "Backspace" });

    // Step 2 should be deleted and Step 1 should now be being edited
    expect(screen.queryByText("Step 2")).toBeNull();
    const prevEditInput = screen.getByLabelText("Edit step");
    expect(prevEditInput).toBeInTheDocument();
    expect(prevEditInput).toHaveValue("Step 1");
  });

  it("clears draft text and blurs input without collapsing when Escape is pressed", () => {
    const onCollapse = vi.fn();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SubtaskList
          projectId={null}
          draftSubtasks={["Existing step"]}
          onCollapse={onCollapse}
        />
      </QueryClientProvider>,
    );

    const input = screen.getByPlaceholderText("Add a step...");
    input.focus();
    fireEvent.change(input, { target: { value: "Draft in progress" } });
    expect(input).toHaveValue("Draft in progress");

    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveValue("");
    expect(document.activeElement).not.toBe(input);
    expect(onCollapse).not.toHaveBeenCalled();
    expect(screen.getByText("Existing step")).toBeInTheDocument();
  });

  it("cancels edit mode without changes when Escape is pressed during edit", () => {
    const queryClient = new QueryClient();

    function Wrapper() {
      const [draftSubtasks, setDraftSubtasks] = useState<string[]>([
        "Original step text",
      ]);
      return (
        <SubtaskList
          projectId={null}
          draftSubtasks={draftSubtasks}
          onDraftSubtasksChange={setDraftSubtasks}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <Wrapper />
      </QueryClientProvider>,
    );

    // Click to start editing
    fireEvent.click(screen.getByText("Original step text"));
    const editInput = screen.getByLabelText("Edit step");
    fireEvent.change(editInput, { target: { value: "Modified text" } });

    fireEvent.keyDown(editInput, { key: "Escape" });

    expect(screen.queryByLabelText("Edit step")).toBeNull();
    expect(screen.getByText("Original step text")).toBeInTheDocument();
  });

  it("saves edited step text on Enter during edit mode", () => {
    const queryClient = new QueryClient();

    function Wrapper() {
      const [draftSubtasks, setDraftSubtasks] = useState<string[]>([
        "Original step text",
      ]);
      return (
        <SubtaskList
          projectId={null}
          draftSubtasks={draftSubtasks}
          onDraftSubtasksChange={setDraftSubtasks}
        />
      );
    }

    render(
      <QueryClientProvider client={queryClient}>
        <Wrapper />
      </QueryClientProvider>,
    );

    // Click to start editing
    fireEvent.click(screen.getByText("Original step text"));
    const editInput = screen.getByLabelText("Edit step");
    fireEvent.change(editInput, { target: { value: "Updated step text" } });

    fireEvent.keyDown(editInput, { key: "Enter" });

    expect(screen.queryByLabelText("Edit step")).toBeNull();
    expect(screen.getByText("Updated step text")).toBeInTheDocument();
  });
});
