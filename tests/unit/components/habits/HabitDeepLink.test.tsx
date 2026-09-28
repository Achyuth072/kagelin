import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { HabitDeepLink } from "@/components/habits/HabitDeepLink";
import type { Habit } from "@/lib/types/habit";

const openHabitInsights = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({ openHabitInsights }),
}));

const run = { id: "habit-1", name: "Run" } as Habit;

describe("HabitDeepLink", () => {
  let replaceState: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    replaceState = vi.spyOn(window.history, "replaceState");
  });

  it("opens the habit named in the URL and clears the param", () => {
    search = "habit=habit-1";
    render(<HabitDeepLink habits={[run]} />);

    expect(openHabitInsights).toHaveBeenCalledWith(run);
    expect(replaceState.mock.calls[0][2]).toBe("/habits");
  });

  it("clears the param without opening anything for an unknown habit", () => {
    search = "habit=gone";
    render(<HabitDeepLink habits={[run]} />);

    expect(openHabitInsights).not.toHaveBeenCalled();
    expect(replaceState.mock.calls[0][2]).toBe("/habits");
  });

  it("does nothing without the param", () => {
    search = "";
    render(<HabitDeepLink habits={[run]} />);

    expect(openHabitInsights).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
