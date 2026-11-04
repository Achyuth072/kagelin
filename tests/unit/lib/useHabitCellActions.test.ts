import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useHabitCellActions } from "@/lib/hooks/useHabitCellActions";
import { ENTRY_VALUE_SKIPPED, type HabitWithEntries } from "@/lib/types/habit";
import * as useHabitMutationsModule from "@/lib/hooks/useHabitMutations";
import * as useHapticModule from "@/lib/hooks/useHaptic";
import * as notifyModule from "@/lib/notify";

vi.mock("@/lib/hooks/useHabitMutations");
vi.mock("@/lib/hooks/useHaptic");
vi.mock("@/lib/notify");

describe("useHabitCellActions", () => {
  const mutate = vi.fn();
  const triggerHaptic = vi.fn();
  const notify = vi.fn();

  const mockHabit: HabitWithEntries = {
    id: "habit-1",
    user_id: "user-1",
    name: "Exercise",
    description: null,
    color: "#3b82f6",
    icon: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    start_date: "2026-01-01",
    sort_order: 0,
    entries: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useHabitMutationsModule.useMarkHabitComplete).mockReturnValue({
      mutate,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<
      typeof useHabitMutationsModule.useMarkHabitComplete
    >);
    vi.mocked(useHapticModule.useHaptic).mockReturnValue({
      trigger: triggerHaptic,
      isPhone: false,
      hapticsEnabled: true,
    });
    vi.mocked(notifyModule.notify).mockImplementation(
      notify as unknown as typeof notifyModule.notify,
    );
  });

  it("triggers success haptic when cycling from unlogged to done", () => {
    const { result } = renderHook(() => useHabitCellActions(mockHabit));

    act(() => {
      result.current.onToggle("2026-11-04");
    });

    expect(mutate).toHaveBeenCalledWith({
      habitId: "habit-1",
      date: "2026-11-04",
      value: 1,
    });
    expect(triggerHaptic).toHaveBeenCalledWith("success");
    expect(notify).not.toHaveBeenCalled();
  });

  it("notifies and triggers toggle haptic when cycling from done to skipped", () => {
    const habitWithDone: HabitWithEntries = {
      ...mockHabit,
      entries: [
        {
          id: "e1",
          habit_id: "habit-1",
          date: "2026-11-04",
          value: 1,
          created_at: "2026-11-04T00:00:00Z",
        },
      ],
    };
    const { result } = renderHook(() => useHabitCellActions(habitWithDone));

    act(() => {
      result.current.onToggle("2026-11-04");
    });

    expect(mutate).toHaveBeenCalledWith({
      habitId: "habit-1",
      date: "2026-11-04",
      value: ENTRY_VALUE_SKIPPED,
    });
    expect(triggerHaptic).toHaveBeenCalledWith("toggle");
    expect(notify).toHaveBeenCalledWith(
      "Marked as skipped (rest day). Tap again to clear.",
    );
  });

  it("notifies and triggers thud haptic when cycling from skipped to cleared (null)", () => {
    const habitWithSkipped: HabitWithEntries = {
      ...mockHabit,
      entries: [
        {
          id: "e1",
          habit_id: "habit-1",
          date: "2026-11-04",
          value: ENTRY_VALUE_SKIPPED,
          created_at: "2026-11-04T00:00:00Z",
        },
      ],
    };
    const { result } = renderHook(() => useHabitCellActions(habitWithSkipped));

    act(() => {
      result.current.onToggle("2026-11-04");
    });

    expect(mutate).toHaveBeenCalledWith({
      habitId: "habit-1",
      date: "2026-11-04",
      value: null,
    });
    expect(triggerHaptic).toHaveBeenCalledWith("thud");
    expect(notify).toHaveBeenCalledWith("Habit entry cleared");
  });

  it("notifies and triggers thud haptic on onClearValue", () => {
    const { result } = renderHook(() => useHabitCellActions(mockHabit));

    act(() => {
      result.current.onClearValue("2026-11-04");
    });

    expect(mutate).toHaveBeenCalledWith({
      habitId: "habit-1",
      date: "2026-11-04",
      value: null,
    });
    expect(triggerHaptic).toHaveBeenCalledWith("thud");
    expect(notify).toHaveBeenCalledWith("Habit entry cleared");
  });
});
