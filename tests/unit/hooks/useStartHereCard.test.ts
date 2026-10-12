import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStartHereCard } from "@/lib/hooks/useStartHereCard";
import { useUiStore } from "@/lib/store/uiStore";

const mockTasksData: { data: unknown[]; isFetching: boolean } = {
  data: [],
  isFetching: false,
};
const mockHabitsData: { data: unknown[]; isFetching: boolean } = {
  data: [],
  isFetching: false,
};
const mockFocusData: { data: boolean; isFetching: boolean } = {
  data: false,
  isFetching: false,
};
let mockDemoMode = false;

vi.mock("@/lib/hooks/useDemoMode", () => ({
  useDemoMode: () => mockDemoMode,
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => mockTasksData,
}));

vi.mock("@/lib/hooks/useHabits", () => ({
  useHabits: () => mockHabitsData,
}));

vi.mock("@/lib/hooks/useHasFocusLog", () => ({
  useHasFocusLog: () => mockFocusData,
}));

describe("useStartHereCard", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ startHereStates: {} });
    mockTasksData.data = [];
    mockTasksData.isFetching = false;
    mockHabitsData.data = [];
    mockHabitsData.isFetching = false;
    mockFocusData.data = false;
    mockFocusData.isFetching = false;
    mockDemoMode = false;
  });

  it("evaluates a new user as eligible and visible", () => {
    const { result } = renderHook(() => useStartHereCard("user-1"));

    expect(result.current.isVisible).toBe(true);
    expect(result.current.state?.eligible).toBe(true);
    expect(result.current.state?.dismissed).toBe(false);
    expect(result.current.done("task")).toBe(false);
  });

  it("marks task as done when tasks exist", () => {
    mockTasksData.data = [{ id: "t1", project_id: "p1" }];

    const { result } = renderHook(() => useStartHereCard("user-1"));

    expect(result.current.done("task")).toBe(true);
    expect(result.current.state?.done).toContain("task");
  });

  it("hides when dismissed", () => {
    const { result } = renderHook(() => useStartHereCard("user-1"));

    act(() => {
      result.current.save({
        ...result.current.state!,
        dismissed: true,
      });
    });

    expect(result.current.isVisible).toBe(false);
  });

  it("hides in demo mode", () => {
    mockDemoMode = true;
    const { result } = renderHook(() => useStartHereCard("user-1"));

    expect(result.current.isVisible).toBe(false);
  });
});
