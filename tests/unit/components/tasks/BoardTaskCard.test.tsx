import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BoardTaskCard } from "@/components/tasks/BoardTaskCard";
import type { Task } from "@/lib/types/task";
import React from "react";

describe("BoardTaskCard", () => {
  const baseTask: Task = {
    id: "board-task-1",
    user_id: "user-1",
    project_id: null,
    parent_id: null,
    content: "Kanban Item",
    description: null,
    priority: 1,
    due_date: "2026-12-01",
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

  it("renders priority glyph and padded 44px checkbox bounds", () => {
    const handleComplete = vi.fn();
    render(
      <BoardTaskCard
        task={baseTask}
        project={{ color: "#3b82f6", name: "Work" }}
        handleComplete={handleComplete}
        handlePlayFocus={vi.fn()}
      />,
    );

    // 44px tap area via -m-2.5 p-2.5
    const checkboxContainer = screen.getByTestId("board-checkbox-container");
    expect(checkboxContainer.className).toContain("-m-2.5");
    expect(checkboxContainer.className).toContain("p-2.5");

    // Stepped priority glyph for P1
    const glyph = screen.getByRole("img", { name: "Priority P1" });
    expect(glyph).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();

    // Checkbox toggle
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(handleComplete).toHaveBeenCalled();
  });
});
