import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GlobalHotkeys } from "@/components/layout/GlobalHotkeys";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), resolvedTheme: "light" }),
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn(), isAddTaskOpen: false }),
}));
vi.mock("@/components/CompletedTasksProvider", () => ({
  useCompletedTasks: () => ({ openSheet: vi.fn() }),
}));
vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({ openAddHabit: vi.fn(), isHabitSheetOpen: false }),
}));
vi.mock("@/components/ProjectActionsProvider", () => ({
  useProjectActions: () => ({
    openCreateProject: vi.fn(),
    isCreateProjectOpen: false,
  }),
}));
vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: () => ({
    openCreateEvent: vi.fn(),
    isCreateEventOpen: false,
  }),
}));
vi.mock("@/lib/hooks/useShortcutTips", () => ({
  useShortcutTips: () => ({
    recordMouseAction: vi.fn(),
    recordKeyAction: vi.fn(),
  }),
}));

describe("GlobalHotkeys — ? shortcuts help trigger", () => {
  const setHelpOpen = vi.fn();

  beforeEach(() => {
    setHelpOpen.mockClear();
  });

  it("opens shortcuts help when ? is pressed with shiftKey: true (US layout)", () => {
    render(
      <GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={setHelpOpen} />,
    );

    fireEvent.keyDown(document, { key: "?", shiftKey: true });

    expect(setHelpOpen).toHaveBeenCalledTimes(1);
  });

  it("opens shortcuts help when ? is pressed without shiftKey (international layouts)", () => {
    render(
      <GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={setHelpOpen} />,
    );

    fireEvent.keyDown(document, { key: "?", shiftKey: false });

    expect(setHelpOpen).toHaveBeenCalledTimes(1);
  });

  it("opens shortcuts help when Shift+H is pressed", () => {
    render(
      <GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={setHelpOpen} />,
    );

    fireEvent.keyDown(document, { key: "H", code: "KeyH", shiftKey: true });

    expect(setHelpOpen).toHaveBeenCalledTimes(1);
  });
});
