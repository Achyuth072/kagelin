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

    // 44px tap area via -m-3.5 p-3.5
    const checkboxContainer = screen.getByTestId("board-checkbox-container");
    expect(checkboxContainer.className).toContain("-m-3.5");
    expect(checkboxContainer.className).toContain("p-3.5");

    // Stepped priority glyph for P1
    const glyph = screen.getByRole("img", { name: "Priority P1" });
    expect(glyph).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();

    // Checkbox toggle
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(handleComplete).toHaveBeenCalled();
  });

  it("renders planned do_date chip with CalendarClock and accessible high-contrast emphasis", () => {
    const plannedTask: Task = {
      ...baseTask,
      do_date: new Date().toISOString().split("T")[0],
    };
    render(
      <BoardTaskCard
        task={plannedTask}
        project={undefined}
        handleComplete={vi.fn()}
        handlePlayFocus={vi.fn()}
      />,
    );

    const plannedChip = screen.getByText("Planned Today").parentElement;
    expect(plannedChip).toBeInTheDocument();
    expect(plannedChip).toHaveClass("bg-secondary/70", "font-semibold");
  });

  it("renders overdue due_date chip with high-contrast emphasis", () => {
    const overdueTask: Task = {
      ...baseTask,
      due_date: "2020-01-01",
    };
    render(
      <BoardTaskCard
        task={overdueTask}
        project={undefined}
        handleComplete={vi.fn()}
        handlePlayFocus={vi.fn()}
      />,
    );

    const dueChip = screen.getByText("Jan 1").parentElement;
    expect(dueChip).toHaveClass("bg-secondary/70", "font-semibold");
  });

  it("renders pre-allocated zero-jump action cluster with play and delete buttons", () => {
    const handleDelete = vi.fn();
    const handleFocus = vi.fn();

    render(
      <BoardTaskCard
        task={baseTask}
        project={undefined}
        handleComplete={vi.fn()}
        handlePlayFocus={handleFocus}
        onDeleteRequest={handleDelete}
      />,
    );

    const actionCluster = screen.getByTestId("board-hover-actions");
    expect(actionCluster).toHaveClass("w-14", "justify-end");

    const deleteBtn = screen.getByRole("button", { name: "Delete task" });
    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalled();

    const focusBtn = screen.getByRole("button", { name: "Start focus timer" });
    fireEvent.click(focusBtn);
    expect(handleFocus).toHaveBeenCalled();
  });

  it("renders 14x14 squircle checkbox with custom checkmark when completed", () => {
    const completedTask: Task = {
      ...baseTask,
      is_completed: true,
    };
    render(
      <BoardTaskCard
        task={completedTask}
        project={undefined}
        handleComplete={vi.fn()}
        handlePlayFocus={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    const squircle = checkbox.querySelector("span");
    expect(squircle).toHaveClass("w-3.5", "h-3.5", "rounded-[3.5px]");
  });
});
