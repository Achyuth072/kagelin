import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { HabitDeepLink } from "@/components/habits/HabitDeepLink";
import type { Habit } from "@/lib/types/habit";

const replace = vi.fn();
const openHabitInsights = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({ openHabitInsights }),
}));

const run = { id: "habit-1", name: "Run" } as Habit;

describe("HabitDeepLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the habit named in the URL and clears the param", () => {
    search = "habit=habit-1";
    render(<HabitDeepLink habits={[run]} />);

    expect(openHabitInsights).toHaveBeenCalledWith(run);
    expect(replace).toHaveBeenCalledWith("/habits");
  });

  it("clears the param without opening anything for an unknown habit", () => {
    search = "habit=gone";
    render(<HabitDeepLink habits={[run]} />);

    expect(openHabitInsights).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/habits");
  });

  it("does nothing without the param", () => {
    search = "";
    render(<HabitDeepLink habits={[run]} />);

    expect(openHabitInsights).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
