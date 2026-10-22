import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  MigrationExportTab,
  formatHabitSummary,
  formatTodoistSummary,
} from "@/components/settings/MigrationExportTab";
import { mockStore } from "@/lib/mock/mock-store";
import type { Habit } from "@/lib/types/habit";
import type { Task, Project } from "@/lib/types/task";

const {
  mockTrigger,
  mockExportLoopDb,
  mockExportLoopZip,
  mockExportTodoistZip,
  mockUseHabits,
  mockUseTasks,
  mockUseProjects,
} = vi.hoisted(() => ({
  mockTrigger: vi.fn(),
  mockExportLoopDb: vi.fn(),
  mockExportLoopZip: vi.fn(),
  mockExportTodoistZip: vi.fn(),
  mockUseHabits: vi.fn(),
  mockUseTasks: vi.fn(),
  mockUseProjects: vi.fn(),
}));

let mockIsGuestMode = false;
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    isGuestMode: mockIsGuestMode,
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockTrigger,
  }),
}));

let mockLoopExporting = false;
vi.mock("@/lib/hooks/useUhabitsExport", () => ({
  useUhabitsExport: () => ({
    exportLoopDb: mockExportLoopDb,
    exportLoopZip: mockExportLoopZip,
    isExporting: mockLoopExporting,
  }),
}));

let mockTodoistExporting = false;
vi.mock("@/lib/hooks/useTodoistExport", () => ({
  useTodoistExport: () => ({
    exportTodoistZip: mockExportTodoistZip,
    isExporting: mockTodoistExporting,
  }),
}));

vi.mock("@/lib/hooks/useHabits", () => ({
  useHabits: () => mockUseHabits(),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => mockUseTasks(),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: () => mockUseProjects(),
}));

describe("MigrationExportTab formatting helpers", () => {
  describe("formatHabitSummary", () => {
    it("returns 'No habits to export' when count is 0", () => {
      expect(formatHabitSummary(0)).toBe("No habits to export");
    });

    it("returns singular form for 1 habit", () => {
      expect(formatHabitSummary(1)).toBe("1 habit ready to export");
    });

    it("returns plural form for multiple habits", () => {
      expect(formatHabitSummary(12)).toBe("12 habits ready to export");
    });
  });

  describe("formatTodoistSummary", () => {
    it("returns 'No active tasks' when taskCount is 0", () => {
      expect(formatTodoistSummary(0, 3)).toBe("No active tasks");
      expect(formatTodoistSummary(0, 0)).toBe("No active tasks");
    });

    it("formats tasks when projectCount is 0", () => {
      expect(formatTodoistSummary(1, 0)).toBe("1 task");
      expect(formatTodoistSummary(5, 0)).toBe("5 tasks");
    });

    it("formats singular task and singular project", () => {
      expect(formatTodoistSummary(1, 1)).toBe("1 task across 1 project");
    });

    it("formats plural tasks and singular project", () => {
      expect(formatTodoistSummary(2, 1)).toBe("2 tasks across 1 project");
    });

    it("formats singular task and plural projects", () => {
      expect(formatTodoistSummary(1, 2)).toBe("1 task across 2 projects");
    });

    it("formats plural tasks and plural projects", () => {
      expect(formatTodoistSummary(34, 3)).toBe("34 tasks across 3 projects");
    });
  });
});

describe("MigrationExportTab component rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGuestMode = false;
    mockLoopExporting = false;
    mockTodoistExporting = false;
    mockUseHabits.mockReturnValue({ data: [] });
    mockUseTasks.mockReturnValue({ data: [] });
    mockUseProjects.mockReturnValue({ data: [] });
  });

  describe("Guest Mode rendering", () => {
    beforeEach(() => {
      mockIsGuestMode = true;
    });

    it("renders live counts from mockStore when populated", () => {
      vi.spyOn(mockStore, "getHabits").mockReturnValue([
        { id: "h1", name: "Exercise", archived_at: null },
        { id: "h2", name: "Read", archived_at: null },
        { id: "h3", name: "Old", archived_at: "2026-01-01" },
      ] as unknown as Habit[]);
      vi.spyOn(mockStore, "getProjects").mockReturnValue([
        { id: "p1", name: "Work", is_archived: false },
        { id: "p2", name: "Personal", is_archived: false },
        { id: "p3", name: "Archived", is_archived: true },
      ] as unknown as Project[]);
      vi.spyOn(mockStore, "getTasks").mockReturnValue([
        { id: "t1", title: "Task 1", is_completed: false, project_id: "p1" },
        { id: "t2", title: "Task 2", is_completed: false, project_id: "p2" },
        { id: "t3", title: "Completed", is_completed: true, project_id: "p1" },
        {
          id: "t4",
          title: "In Archived Proj",
          is_completed: false,
          project_id: "p3",
        },
      ] as unknown as Task[]);

      render(<MigrationExportTab />);

      expect(
        screen.getByRole("heading", { name: "Loop Habit Tracker" }),
      ).toBeInTheDocument();
      expect(screen.getByText("2 habits ready to export")).toBeInTheDocument();

      expect(
        screen.getByRole("heading", { name: "Todoist" }),
      ).toBeInTheDocument();
      expect(screen.getByText("2 tasks across 2 projects")).toBeInTheDocument();
    });

    it("renders zero states from mockStore when empty", () => {
      vi.spyOn(mockStore, "getHabits").mockReturnValue([]);
      vi.spyOn(mockStore, "getProjects").mockReturnValue([]);
      vi.spyOn(mockStore, "getTasks").mockReturnValue([]);

      render(<MigrationExportTab />);

      expect(screen.getByText("No habits to export")).toBeInTheDocument();
      expect(screen.getByText("No active tasks")).toBeInTheDocument();
    });
  });

  describe("Registered Mode rendering", () => {
    beforeEach(() => {
      mockIsGuestMode = false;
    });

    it("renders live counts from hooks/query data", () => {
      mockUseHabits.mockReturnValue({
        data: [{ id: "h1", name: "Hydrate", archived_at: null }],
      });
      mockUseProjects.mockReturnValue({
        data: [
          { id: "p1", name: "Work", is_archived: false },
          { id: "p2", name: "Archive", is_archived: true },
        ],
      });
      mockUseTasks.mockReturnValue({
        data: [
          {
            id: "t1",
            title: "Parent",
            is_completed: false,
            subtasks: [
              { id: "s1", is_completed: false },
              { id: "s2", is_completed: true },
            ],
          },
          {
            id: "t2",
            title: "Done",
            is_completed: true,
            subtasks: [],
          },
        ],
      });

      render(<MigrationExportTab />);

      expect(screen.getByText("1 habit ready to export")).toBeInTheDocument();
      // t1 (1) + s1 (1) = 2 active tasks; 1 active project (p1)
      expect(screen.getByText("2 tasks across 1 project")).toBeInTheDocument();
    });
  });

  describe("Export actions and loading states", () => {
    it("dispatches exportLoopDb and haptic on Export (.db) click", async () => {
      mockExportLoopDb.mockResolvedValue(true);
      render(<MigrationExportTab />);

      const dbButton = screen.getByRole("button", {
        name: "Export Loop Habit Tracker database",
      });
      await fireEvent.click(dbButton);

      expect(mockTrigger).toHaveBeenCalledWith("toggle");
      expect(mockExportLoopDb).toHaveBeenCalledTimes(1);
    });

    it("dispatches exportLoopZip and haptic on Export (CSV Zip) click", async () => {
      mockExportLoopZip.mockResolvedValue(true);
      render(<MigrationExportTab />);

      const zipButton = screen.getByRole("button", {
        name: "Export Loop Habit Tracker CSV archive",
      });
      await fireEvent.click(zipButton);

      expect(mockTrigger).toHaveBeenCalledWith("toggle");
      expect(mockExportLoopZip).toHaveBeenCalledTimes(1);
    });

    it("dispatches exportTodoistZip and haptic on Export (.zip) click", async () => {
      mockExportTodoistZip.mockResolvedValue(true);
      render(<MigrationExportTab />);

      const todoistButton = screen.getByRole("button", {
        name: "Export Todoist ZIP archive",
      });
      await fireEvent.click(todoistButton);

      expect(mockTrigger).toHaveBeenCalledWith("toggle");
      expect(mockExportTodoistZip).toHaveBeenCalledTimes(1);
    });

    it("disables both Loop buttons and shows spinner when Loop export is active", () => {
      mockLoopExporting = true;
      mockTodoistExporting = false;
      const { container } = render(<MigrationExportTab />);

      const dbButton = screen.getByRole("button", {
        name: "Export Loop Habit Tracker database",
      });
      const zipButton = screen.getByRole("button", {
        name: "Export Loop Habit Tracker CSV archive",
      });
      const todoistButton = screen.getByRole("button", {
        name: "Export Todoist ZIP archive",
      });

      expect(dbButton).toBeDisabled();
      expect(zipButton).toBeDisabled();
      expect(todoistButton).not.toBeDisabled();

      // Check for spinner
      expect(container.querySelectorAll(".animate-spin").length).toBe(2);
    });

    it("disables Todoist button and shows spinner when Todoist export is active", () => {
      mockLoopExporting = false;
      mockTodoistExporting = true;
      const { container } = render(<MigrationExportTab />);

      const dbButton = screen.getByRole("button", {
        name: "Export Loop Habit Tracker database",
      });
      const zipButton = screen.getByRole("button", {
        name: "Export Loop Habit Tracker CSV archive",
      });
      const todoistButton = screen.getByRole("button", {
        name: "Export Todoist ZIP archive",
      });

      expect(dbButton).not.toBeDisabled();
      expect(zipButton).not.toBeDisabled();
      expect(todoistButton).toBeDisabled();

      // Check for spinner
      expect(container.querySelectorAll(".animate-spin").length).toBe(1);
    });
  });
});
