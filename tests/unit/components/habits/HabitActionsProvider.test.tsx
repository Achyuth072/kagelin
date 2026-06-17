import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  HabitActionsProvider,
  useHabitActions,
} from "@/components/habits/HabitActionsProvider";
import type { Habit } from "@/lib/types/habit";

const mockHabit = { id: "1", name: "Exercise" } as unknown as Habit;

function Probe() {
  const {
    isHabitSheetOpen,
    editingHabit,
    initialTab,
    openHabitInsights,
    openEditHabit,
    openAddHabit,
  } = useHabitActions();
  return (
    <div>
      <span data-testid="open">{String(isHabitSheetOpen)}</span>
      <span data-testid="tab">{initialTab}</span>
      <span data-testid="habit">{editingHabit?.name ?? "none"}</span>
      <button onClick={() => openHabitInsights(mockHabit)}>insights</button>
      <button onClick={() => openEditHabit(mockHabit)}>edit</button>
      <button onClick={() => openAddHabit()}>add</button>
    </div>
  );
}

describe("HabitActionsProvider — openHabitInsights", () => {
  it("opens the sheet on the Insights tab for the given habit", () => {
    render(
      <HabitActionsProvider>
        <Probe />
      </HabitActionsProvider>,
    );

    fireEvent.click(screen.getByText("insights"));

    expect(screen.getByTestId("open")).toHaveTextContent("true");
    expect(screen.getByTestId("tab")).toHaveTextContent("insights");
    expect(screen.getByTestId("habit")).toHaveTextContent("Exercise");
  });

  it("resets to the Edit tab via openEditHabit", () => {
    render(
      <HabitActionsProvider>
        <Probe />
      </HabitActionsProvider>,
    );

    fireEvent.click(screen.getByText("insights"));
    fireEvent.click(screen.getByText("edit"));

    expect(screen.getByTestId("tab")).toHaveTextContent("edit");
  });

  it("resets to the Edit tab via openAddHabit", () => {
    render(
      <HabitActionsProvider>
        <Probe />
      </HabitActionsProvider>,
    );

    fireEvent.click(screen.getByText("insights"));
    fireEvent.click(screen.getByText("add"));

    expect(screen.getByTestId("tab")).toHaveTextContent("edit");
  });
});
