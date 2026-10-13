import { render, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GlobalHotkeys } from "@/components/layout/GlobalHotkeys";
import { useUiStore } from "@/lib/store/uiStore";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ setTheme: vi.fn(), resolvedTheme: "light" }),
}));

const mockOpenAddTask = vi.fn();
vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({
    openAddTask: mockOpenAddTask,
    isAddTaskOpen: false,
  }),
}));

const mockOpenCompletedSheet = vi.fn();
vi.mock("@/components/CompletedTasksProvider", () => ({
  useCompletedTasks: () => ({ openSheet: mockOpenCompletedSheet }),
}));

const mockOpenAddHabit = vi.fn();
vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({
    openAddHabit: mockOpenAddHabit,
    isHabitSheetOpen: false,
  }),
}));

const mockOpenCreateProject = vi.fn();
vi.mock("@/components/ProjectActionsProvider", () => ({
  useProjectActions: () => ({
    openCreateProject: mockOpenCreateProject,
    isCreateProjectOpen: false,
  }),
}));

const mockOpenCreateEvent = vi.fn();
vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: () => ({
    openCreateEvent: mockOpenCreateEvent,
    isCreateEventOpen: false,
  }),
}));

const mockRecordKeyAction = vi.fn();
vi.mock("@/lib/hooks/useShortcutTips", () => ({
  useShortcutTips: () => ({
    recordMouseAction: vi.fn(),
    recordKeyAction: mockRecordKeyAction,
  }),
}));

describe("GlobalHotkeys — shortcut tip suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({
      viewMode: "list",
      yankedTaskId: null,
      isShortcutsHelpOpen: false,
    });
  });

  it("records key action for newTask when 'n' is pressed", () => {
    render(<GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={vi.fn()} />);

    act(() => {
      fireEvent.keyDown(document, { key: "n", code: "KeyN" });
    });

    expect(mockRecordKeyAction).toHaveBeenCalledWith("newTask");
    expect(mockOpenAddTask).toHaveBeenCalledTimes(1);
  });

  it("records key action for newHabit when 'h' is pressed", () => {
    render(<GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={vi.fn()} />);

    act(() => {
      fireEvent.keyDown(document, { key: "h", code: "KeyH" });
    });

    expect(mockRecordKeyAction).toHaveBeenCalledWith("newHabit");
    expect(mockOpenAddHabit).toHaveBeenCalledTimes(1);
  });

  it("records key action for newEvent when 'e' is pressed", () => {
    render(<GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={vi.fn()} />);

    act(() => {
      fireEvent.keyDown(document, { key: "e", code: "KeyE" });
    });

    expect(mockRecordKeyAction).toHaveBeenCalledWith("newEvent");
    expect(mockOpenCreateEvent).toHaveBeenCalledTimes(1);
  });

  it("records key action for newProject when 'p' is pressed", () => {
    render(<GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={vi.fn()} />);

    act(() => {
      fireEvent.keyDown(document, { key: "p", code: "KeyP" });
    });

    expect(mockRecordKeyAction).toHaveBeenCalledWith("newProject");
    expect(mockOpenCreateProject).toHaveBeenCalledTimes(1);
  });

  it("records key action for logbook when 'c' is pressed", () => {
    render(<GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={vi.fn()} />);

    act(() => {
      fireEvent.keyDown(document, { key: "c", code: "KeyC" });
    });

    expect(mockRecordKeyAction).toHaveBeenCalledWith("logbook");
    expect(mockOpenCompletedSheet).toHaveBeenCalledTimes(1);
  });
});
