import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ListTaskCard } from "@/components/tasks/ListTaskCard";
import { BoardTaskCard } from "@/components/tasks/BoardTaskCard";
import type { Task } from "@/lib/types/task";

const baseTask: Task = {
  id: "test-task-1",
  user_id: "user-1",
  project_id: null,
  parent_id: null,
  content: "Test Task with Steps",
  description: null,
  priority: 4,
  due_date: null,
  do_date: null,
  is_evening: false,
  is_completed: false,
  completed_at: null,
  day_order: 0,
  recurrence: null,
  recurring_series_id: null,
  google_event_id: null,
  google_etag: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("Step Progress Badge", () => {
  describe("ListTaskCard", () => {
    it("does not render a step progress badge when task has no steps", () => {
      render(
        <ListTaskCard
          task={{ ...baseTask, subtasks: [] }}
          isDesktop={true}
          isExpanded={false}
          toggleExpand={() => {}}
          handleComplete={() => {}}
          handlePlayFocus={() => {}}
          onDeleteRequest={() => {}}
          project={undefined}
        />,
      );

      expect(screen.queryByTestId("step-progress-badge")).toBeNull();
    });

    it("renders partial progress badge (e.g. 2/5) with ListChecks icon when some steps are incomplete", () => {
      const taskWithSteps: Task = {
        ...baseTask,
        subtasks: [
          { id: "s1", is_completed: true },
          { id: "s2", is_completed: true },
          { id: "s3", is_completed: false },
          { id: "s4", is_completed: false },
          { id: "s5", is_completed: false },
        ],
      };

      render(
        <ListTaskCard
          task={taskWithSteps}
          isDesktop={true}
          isExpanded={false}
          toggleExpand={() => {}}
          handleComplete={() => {}}
          handlePlayFocus={() => {}}
          onDeleteRequest={() => {}}
          project={undefined}
        />,
      );

      const badge = screen.getByTestId("step-progress-badge");
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain("2/5");
      expect(badge.className).not.toContain("text-brand");
      expect(badge.querySelector(".lucide-list-checks")).toBeTruthy();
      expect(badge.querySelector(".lucide-check-circle-2")).toBeNull();
    });

    it("renders completed progress badge (e.g. 5/5) with CheckCircle2 icon and brand color when all steps are completed", () => {
      const taskWithAllCompletedSteps: Task = {
        ...baseTask,
        subtasks: [
          { id: "s1", is_completed: true },
          { id: "s2", is_completed: true },
          { id: "s3", is_completed: true },
          { id: "s4", is_completed: true },
          { id: "s5", is_completed: true },
        ],
      };

      render(
        <ListTaskCard
          task={taskWithAllCompletedSteps}
          isDesktop={true}
          isExpanded={false}
          toggleExpand={() => {}}
          handleComplete={() => {}}
          handlePlayFocus={() => {}}
          onDeleteRequest={() => {}}
          project={undefined}
        />,
      );

      const badge = screen.getByTestId("step-progress-badge");
      expect(badge.querySelector("svg")?.getAttribute("class")).toContain(
        "lucide",
      );
      expect(badge.textContent).toContain("5/5");
      expect(badge.className).toContain("text-brand");
      expect(badge.querySelector(".lucide-list-checks")).toBeNull();
    });
  });

  describe("BoardTaskCard", () => {
    it("does not render a step progress badge when task has no steps", () => {
      render(
        <BoardTaskCard
          task={{ ...baseTask, subtasks: [] }}
          project={undefined}
          handleComplete={() => {}}
          handlePlayFocus={() => {}}
        />,
      );

      expect(screen.queryByTestId("step-progress-badge")).toBeNull();
    });

    it("renders partial progress badge (e.g. 1/3) with ListChecks icon on board card", () => {
      const taskWithSteps: Task = {
        ...baseTask,
        subtasks: [
          { id: "s1", is_completed: true },
          { id: "s2", is_completed: false },
          { id: "s3", is_completed: false },
        ],
      };

      render(
        <BoardTaskCard
          task={taskWithSteps}
          project={undefined}
          handleComplete={() => {}}
          handlePlayFocus={() => {}}
        />,
      );

      const badge = screen.getByTestId("step-progress-badge");
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain("1/3");
      expect(badge.className).not.toContain("text-brand");
      expect(badge.querySelector(".lucide-list-checks")).toBeTruthy();
    });

    it("renders completed badge (e.g. 3/3) with CheckCircle2 icon and brand color on board card", () => {
      const taskWithAllCompletedSteps: Task = {
        ...baseTask,
        subtasks: [
          { id: "s1", is_completed: true },
          { id: "s2", is_completed: true },
          { id: "s3", is_completed: true },
        ],
      };

      render(
        <BoardTaskCard
          task={taskWithAllCompletedSteps}
          project={undefined}
          handleComplete={() => {}}
          handlePlayFocus={() => {}}
        />,
      );

      const badge = screen.getByTestId("step-progress-badge");
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain("3/3");
      expect(badge.className).toContain("text-brand");
      expect(badge.querySelector("svg")?.getAttribute("class")).toContain(
        "lucide",
      );
      expect(badge.querySelector(".lucide-list-checks")).toBeNull();
    });
  });
});
