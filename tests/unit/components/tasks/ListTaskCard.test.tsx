import { render, screen, fireEvent } from "@testing-library/react";
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
    priority: 1,
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
    subtasks: [
      {
        id: "step-1",
        is_completed: true,
      },
      {
        id: "step-2",
        is_completed: false,
      },
    ],
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

    const plannedChip = screen.getByText("Planned Today").parentElement;
    expect(plannedChip).toBeDefined();
    expect(plannedChip).toHaveClass("bg-secondary/70", "font-semibold");
    expect(screen.getByText(/Dec 31/)).toBeDefined();
  });

  it("renders Folio Continuous geometry, breathing padding, 44px tap bounds, and hover cluster", () => {
    const handleComplete = vi.fn();
    const handlePlayFocus = vi.fn();
    const onDeleteRequest = vi.fn();
    const toggleExpand = vi.fn();

    const { container } = render(
      <ListTaskCard
        task={baseTask}
        isDesktop={true}
        isExpanded={false}
        toggleExpand={toggleExpand}
        handleComplete={handleComplete}
        handlePlayFocus={handlePlayFocus}
        onDeleteRequest={onDeleteRequest}
        project={{ color: "#10b981", name: "Client Work" }}
      />,
    );

    // Folio continuous container classes
    const row = container.querySelector("[data-task-row]");
    expect(row).toBeInTheDocument();
    expect(row?.className).toContain("p-3.5");
    expect(row?.className).toContain("border-b");

    // Checkbox container breathing padding & 44px bounds
    const checkboxContainer = screen.getByTestId("task-checkbox-container");
    expect(checkboxContainer.className).toContain("pl-1");
    expect(checkboxContainer.className).toContain("pr-3");
    const checkButton = checkboxContainer.querySelector("button");
    expect(checkButton?.className).toContain("h-11");
    expect(checkButton?.className).toContain("w-11");
    expect(checkButton?.className).toContain("-m-3.5");

    // Zero-layout-shift hover cluster
    const cluster = screen.getByTestId("hover-action-cluster");
    expect(cluster.className).toContain("w-14");
    expect(cluster.className).toContain("flex-shrink-0");

    // Stepped priority glyph and P1 chip
    expect(
      screen.getAllByRole("img", { name: "Priority P1" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("P1")).toBeInTheDocument();

    // Steps fraction chip button
    const stepsButton = screen.getByRole("button", { name: "Expand steps" });
    expect(stepsButton).toHaveTextContent("1/2 steps");
    fireEvent.click(stepsButton);
    expect(toggleExpand).toHaveBeenCalled();

    // Checkbox click
    if (checkButton) {
      fireEvent.click(checkButton);
      expect(handleComplete).toHaveBeenCalledWith(true);
    }
  });

  it("renders visible play button on mobile while keeping delete button desktop-only", () => {
    const handlePlayFocus = vi.fn();
    const onDeleteRequest = vi.fn();

    render(
      <ListTaskCard
        task={baseTask}
        isDesktop={false}
        isExpanded={false}
        toggleExpand={vi.fn()}
        handleComplete={vi.fn()}
        handlePlayFocus={handlePlayFocus}
        onDeleteRequest={onDeleteRequest}
        project={undefined}
      />,
    );

    const cluster = screen.getByTestId("hover-action-cluster");
    expect(cluster).toBeInTheDocument();
    expect(cluster.className).not.toContain("hidden md:flex");
    expect(cluster.className).toContain("opacity-100");

    const playButton = screen.getByRole("button", {
      name: "Start focus timer",
    });
    expect(playButton).toBeInTheDocument();
    fireEvent.click(playButton);
    expect(handlePlayFocus).toHaveBeenCalledTimes(1);

    const deleteButton = screen.getByRole("button", {
      name: "Delete task",
    });
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton.className).toContain("hidden md:inline-flex");
  });
});
