import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { StartHereCard } from "@/components/home/StartHereCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

vi.mock("@/lib/hooks/useDemoMode", () => ({
  useDemoMode: () => false,
}));

const mockOpenAddTask = vi.fn();
vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: mockOpenAddTask }),
}));

const mockOpenAddHabit = vi.fn();
vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({ openAddHabit: mockOpenAddHabit }),
}));

vi.mock("@/lib/hooks/useIsBoardViewOnTasks", () => ({
  useIsBoardViewOnTasks: () => false,
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => ({ data: [], isFetching: false }),
}));

vi.mock("@/lib/hooks/useHabits", () => ({
  useHabits: () => ({ data: [], isFetching: false }),
}));

vi.mock("@/lib/hooks/useHasFocusLog", () => ({
  useHasFocusLog: () => ({ data: false, isFetching: false }),
}));

vi.mock("@/lib/hooks/useAddMeetKagelin", () => ({
  useAddMeetKagelin: () => ({ isPending: false, addAndOpen: vi.fn() }),
}));

describe("StartHereCard — actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("calls openAddTask when Add a task is clicked", () => {
    render(<StartHereCard />);

    const addTaskButton = screen.getAllByText("Add a task")[0];
    fireEvent.click(addTaskButton);

    expect(mockOpenAddTask).toHaveBeenCalledTimes(1);
  });

  it("calls openAddHabit when Create a habit is clicked", () => {
    render(<StartHereCard />);

    const addHabitButton = screen.getAllByText("Create a habit")[0];
    fireEvent.click(addHabitButton);

    expect(mockOpenAddHabit).toHaveBeenCalledTimes(1);
  });
});
