import { describe, it, expect, beforeEach } from "vitest";
import { getTaskUpdatesForGroup } from "@/lib/utils/task-dnd";
import { format, addDays } from "date-fns";
import type { Project } from "@/lib/types/task";

describe("getTaskUpdatesForGroup", () => {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");
  const projectsMap = new Map<string, Project>();

  beforeEach(() => {
    projectsMap.clear();
    projectsMap.set("p1", { id: "p1", name: "Work" } as unknown as Project);
  });

  it("should return correct updates for 'Today' (updating both dates)", () => {
    const updates = getTaskUpdatesForGroup("Today", projectsMap);
    expect(updates.do_date).toBe(todayStr);
    expect(updates.due_date).toBe(todayStr);
    expect(updates.is_evening).toBeUndefined(); // Should NOT force false anymore
  });

  it("should return correct updates for 'Tomorrow' (updating both dates)", () => {
    const updates = getTaskUpdatesForGroup("Tomorrow", projectsMap);
    expect(updates.do_date).toBe(tomorrowStr);
    expect(updates.due_date).toBe(tomorrowStr);
    expect(updates.is_evening).toBeUndefined();
  });

  it("should NOT update date or evening for 'Overdue'", () => {
    const updates = getTaskUpdatesForGroup("Overdue", projectsMap);
    expect(updates.do_date).toBeUndefined();
    expect(updates.is_evening).toBeUndefined();
  });

  it("should update priority for 'High' but preserve evening", () => {
    const updates = getTaskUpdatesForGroup("High", projectsMap);
    expect(updates.priority).toBe(2);
    expect(updates.is_evening).toBeUndefined();
  });

  it("should update project_id for project name", () => {
    const updates = getTaskUpdatesForGroup("Work", projectsMap);
    expect(updates.project_id).toBe("p1");
    expect(updates.is_evening).toBeUndefined();
  });

  it("should set is_evening true for 'This Evening'", () => {
    const updates = getTaskUpdatesForGroup("This Evening", projectsMap);
    expect(updates.is_evening).toBe(true);
  });

  it("should set is_evening false for 'Active'", () => {
    const updates = getTaskUpdatesForGroup("Active", projectsMap);
    expect(updates.is_evening).toBe(false);
  });

  describe("with an explicit groupBy", () => {
    beforeEach(() => {
      projectsMap.set("p2", { id: "p2", name: "Today" } as unknown as Project);
    });

    it("maps a project named 'Today' to its project, not a date", () => {
      const updates = getTaskUpdatesForGroup("Today", projectsMap, "project");
      expect(updates.project_id).toBe("p2");
      expect(updates.do_date).toBeUndefined();
      expect(updates.due_date).toBeUndefined();
    });

    it("maps a project named 'This Evening' to its project, not is_evening", () => {
      projectsMap.set("p3", {
        id: "p3",
        name: "This Evening",
      } as unknown as Project);
      const updates = getTaskUpdatesForGroup(
        "This Evening",
        projectsMap,
        "project",
      );
      expect(updates.project_id).toBe("p3");
      expect(updates.is_evening).toBeUndefined();
    });

    it("falls back to the heuristic cascade when groupBy is omitted", () => {
      const updates = getTaskUpdatesForGroup("Today", projectsMap);
      expect(updates.do_date).toBe(todayStr);
      expect(updates.project_id).toBeUndefined();
    });
  });
});
