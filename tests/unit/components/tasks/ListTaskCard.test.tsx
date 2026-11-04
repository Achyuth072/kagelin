import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ListTaskCard } from "@/components/tasks/ListTaskCard";
import type { Task } from "@/lib/types/task";
import React from "react";

describe("ListTaskCard", () => {
  const baseTask: Task = {
    id: "task-1",
    user_id: "user-1",
    project_id: null,
    parent_id: null,
    content: "Prepare presentation",
    description: null,
    priority: 4,
    due_date: null,
    do_date: null,
    is_evening: false,
    is_completed: false,
    completed_at: null,
    day_order: 0,
    recurrence: null,
    recurring_series_id: null,
    google_event_id: null,
    google_etag: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subtasks: [],
  };

  it("displays 'Planned Today' indicator when task is planned for today via do_date", () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const task: Task = {
      ...baseTask,
      do_date: todayStr,
      due_date: "2099-12-31",
    };

    render(
      <ListTaskCard
        task={task}
        isDesktop={true}
        isExpanded={false}
        toggleExpand={vi.fn()}
        handleComplete={vi.fn()}
        handlePlayFocus={vi.fn()}
        onDeleteRequest={vi.fn()}
        project={undefined}
      />,
    );

    expect(screen.getByText("Planned Today")).toBeDefined();
    expect(screen.getByText(/Dec 31/)).toBeDefined();
  });
});
