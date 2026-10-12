import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import {
  TaskActionsProvider,
  useTaskActions,
} from "@/components/TaskActionsProvider";

const mockRecordMouseAction = vi.fn();
vi.mock("@/lib/hooks/useShortcutTips", () => ({
  useShortcutTips: () => ({
    recordMouseAction: mockRecordMouseAction,
    recordKeyAction: vi.fn(),
  }),
}));

describe("TaskActionsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records mouse action for newTask when openAddTask is called by default", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TaskActionsProvider>{children}</TaskActionsProvider>
    );

    const { result } = renderHook(() => useTaskActions(), { wrapper });

    act(() => {
      result.current.openAddTask();
    });

    expect(result.current.isAddTaskOpen).toBe(true);
    expect(mockRecordMouseAction).toHaveBeenCalledWith("newTask");
  });

  it("does not record mouse action when openAddTask is called with keyboard source", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TaskActionsProvider>{children}</TaskActionsProvider>
    );

    const { result } = renderHook(() => useTaskActions(), { wrapper });

    act(() => {
      result.current.openAddTask({ source: "keyboard" });
    });

    expect(result.current.isAddTaskOpen).toBe(true);
    expect(mockRecordMouseAction).not.toHaveBeenCalled();
  });
});
