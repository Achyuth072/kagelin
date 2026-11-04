import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskItem } from "@/components/tasks/TaskItem";
import type { Task } from "@/lib/types/task";
import React from "react";

const { mockToggleMutate, mockNotify } = vi.hoisted(() => ({
  mockToggleMutate: vi.fn(),
  mockNotify: vi.fn(),
}));

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useDeleteTask: () => ({ mutate: vi.fn() }),
  useToggleTask: () => ({ mutate: mockToggleMutate }),
}));

vi.mock("@/lib/notify", () => ({
  notify: Object.assign((...args: unknown[]) => mockNotify(...args), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

let capturedSwipeRight: (() => void) | undefined;
vi.mock("@/components/tasks/SwipeableTaskContent", () => ({
  SwipeableTaskContent: ({
    children,
    onSwipeRight,
  }: {
    children: React.ReactNode;
    onSwipeRight: () => void;
  }) => {
    capturedSwipeRight = onSwipeRight;
    return <div data-testid="swipeable-task-content">{children}</div>;
  },
}));

describe("TaskItem - mobile swipe to complete", () => {
  const mockTask: Task = {
    id: "task-100",
    content: "Swipe task test",
    project_id: "inbox",
    priority: 4,
    is_completed: false,
    due_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_evening: false,
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
    subtasks: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedSwipeRight = undefined;
  });

  it("marks task as completed on swipe right and provides an Undo toast", () => {
    render(<TaskItem task={mockTask} isDesktop={false} />);

    expect(capturedSwipeRight).toBeDefined();
    act(() => {
      capturedSwipeRight!();
    });

    expect(mockToggleMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "task-100",
        is_completed: true,
      }),
      expect.anything(),
    );

    expect(mockNotify).toHaveBeenCalledWith(
      "Task completed",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    );

    // Call undo action
    const undoAction = mockNotify.mock.calls[0][1].action.onClick;
    mockToggleMutate.mockClear();
    act(() => {
      undoAction();
    });

    expect(mockToggleMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "task-100",
        is_completed: false,
      }),
      expect.anything(),
    );
  });
});
