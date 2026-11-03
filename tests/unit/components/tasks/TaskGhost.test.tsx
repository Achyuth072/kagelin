import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TaskGhost } from "@/components/tasks/TaskGhost";
import type { Task } from "@/lib/types/task";

describe("TaskGhost", () => {
  const baseTask: Task = {
    id: "task-1",
    content: "Implement list ghost parity",
    project_id: "p1",
    priority: 1,
    is_completed: false,
    due_date: "2024-01-01",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_evening: true,
    day_order: 0,
    user_id: "user1",
    parent_id: null,
    description: null,
    do_date: null,
    completed_at: null,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
    subtasks: [
      {
        id: "s1",
        is_completed: true,
      },
      {
        id: "s2",
        is_completed: false,
      },
    ],
  };

  const project = { color: "#3b82f6", name: "Work" };

  it("renders list view with subtask progress badge, overdue indicator, and matching structure", () => {
    const { container } = render(
      <TaskGhost
        task={baseTask}
        isDesktop={true}
        project={project}
        viewMode="list"
      />,
    );

    // Subtasks badge should be rendered
    expect(screen.getByText("1/2")).toBeInTheDocument();

    // Priority flag
    expect(screen.getByText("P1")).toBeInTheDocument();

    // Evening badge
    expect(screen.getByText("Evening")).toBeInTheDocument();

    // Due date (2024-01-01 is in the past, so overdue class should be present)
    const dateText = screen.getByText("Jan 1");
    expect(dateText).toBeInTheDocument();
    expect(dateText.closest("span")?.className).toContain("font-bold");

    // Title has type-body styling
    const title = screen.getByText("Implement list ghost parity");
    expect(title.closest("p")?.className).toContain("type-body");

    // Project accent stripe exists with list view dimensions
    const accentStripe = container.querySelector('[style*="background-color"]');
    expect(accentStripe).toBeInTheDocument();
    expect(accentStripe?.className).toContain("w-1 md:w-1.5");
  });

  it("renders board view with board card layout and step progress badge", () => {
    render(
      <TaskGhost
        task={baseTask}
        isDesktop={true}
        project={project}
        viewMode="board"
      />,
    );

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();
  });

  it("does not render metadata row when task has no metadata attributes", () => {
    const minimalTask: Task = {
      ...baseTask,
      due_date: null,
      priority: 4,
      is_evening: false,
      subtasks: [],
    };

    render(
      <TaskGhost
        task={minimalTask}
        isDesktop={true}
        project={project}
        viewMode="list"
      />,
    );

    expect(screen.queryByText("P4")).not.toBeInTheDocument();
    expect(screen.queryByText("Evening")).not.toBeInTheDocument();
    expect(screen.queryByText("1/2")).not.toBeInTheDocument();
  });
});
