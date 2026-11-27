import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { GlobalHotkeys } from "@/components/layout/GlobalHotkeys";

const mockPush = vi.fn();
const mockUsePathname = vi.fn(() => "/focus");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: vi.fn(() => ({ push: mockPush, prefetch: vi.fn() })),
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

describe("GlobalHotkeys — Escape guard on /focus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/focus");
    window.history.pushState({}, "", "/focus");
  });

  it("exits /focus to / when Escape is pressed and no overlays are open", () => {
    render(<GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={vi.fn()} />);

    fireEvent.keyDown(document, {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      which: 27,
    });

    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("does not exit /focus when Escape is pressed while a dialog is open", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);

    try {
      render(<GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={vi.fn()} />);

      fireEvent.keyDown(document, {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
      });

      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      document.body.removeChild(dialog);
    }
  });

  it("does not exit /focus when Escape has defaultPrevented", () => {
    render(<GlobalHotkeys setCommandOpen={vi.fn()} setHelpOpen={vi.fn()} />);

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();
    document.dispatchEvent(event);

    expect(mockPush).not.toHaveBeenCalled();
  });
});
