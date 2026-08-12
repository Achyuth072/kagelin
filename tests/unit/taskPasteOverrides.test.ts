import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { format } from "date-fns";
import {
  getFilterOverrides,
  getTaskUpdatesForGroup,
  getPasteOverrides,
} from "@/lib/utils/task-dnd";
import { taskMutations } from "@/lib/mutations/task";
import { mockStore } from "@/lib/mock/mock-store";
import type { Task } from "@/lib/types/task";

// yy/p paste: taskMutations.duplicate takes an `overrides` object that pins
// the copy to the view the paste happened in, rather than always landing
// back on the yanked task's own project (see task.ts toDuplicatePayload).

describe("getFilterOverrides", () => {
  it("maps the Today filter to both do_date and due_date", () => {
    const today = format(new Date(), "yyyy-MM-dd");
    expect(getFilterOverrides("today")).toEqual({
      do_date: today,
      due_date: today,
    });
  });

  it("maps the P1 filter to priority 1", () => {
    expect(getFilterOverrides("p1")).toEqual({ priority: 1 });
  });

  it("returns no overrides for an unscoped or unknown filter", () => {
    expect(getFilterOverrides(undefined)).toEqual({});
    expect(getFilterOverrides("something-else")).toEqual({});
  });
});

describe("getTaskUpdatesForGroup (board column paste target)", () => {
  it("resolves a This Evening column to is_evening: true", () => {
    expect(getTaskUpdatesForGroup("This Evening", new Map(), "none")).toEqual({
      is_evening: true,
    });
  });
});

describe("getPasteOverrides (combines project/filter/board-column scoping)", () => {
  it("scopes to the destination project view", () => {
    expect(
      getPasteOverrides({
        projectId: "project-b",
        projectsMap: new Map(),
      }),
    ).toEqual({ project_id: "project-b" });
  });

  it("maps the inbox project view to a null project_id", () => {
    expect(
      getPasteOverrides({ projectId: "inbox", projectsMap: new Map() }),
    ).toEqual({ project_id: null });
  });

  it("leaves project_id untouched on the all-tasks view", () => {
    expect(
      getPasteOverrides({ projectId: "all", projectsMap: new Map() }),
    ).toEqual({});
  });

  it("board column wins over the page's own project/filter scoping", () => {
    expect(
      getPasteOverrides({
        projectId: "project-b",
        filter: "p1",
        targetColumnTitle: "This Evening",
        projectsMap: new Map(),
        groupBy: "none",
      }),
    ).toEqual({
      project_id: "project-b",
      priority: 1,
      is_evening: true,
    });
  });
});

describe("taskMutations.duplicate overrides (guest mode)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.clearData();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("relocates the pasted copy to the destination view, not the source's own project", async () => {
    const source = mockStore.addTask({
      content: "Source task",
      project_id: "project-a",
    });

    const pasted = await taskMutations.duplicate(source as Task, {
      project_id: "project-b",
    });

    expect(pasted.project_id).toBe("project-b");
    // The source itself is untouched.
    expect(mockStore.getTask(source.id)?.project_id).toBe("project-a");
  });

  it("leaves the copy on the source's location when no overrides are given", async () => {
    const source = mockStore.addTask({
      content: "Source task",
      project_id: "project-a",
    });

    const pasted = await taskMutations.duplicate(source as Task);

    expect(pasted.project_id).toBe("project-a");
  });

  it("does not cascade overrides onto duplicated subtasks", async () => {
    const parent = mockStore.addTask({
      content: "Parent",
      project_id: "project-a",
    });
    mockStore.addTask({
      content: "Child",
      project_id: "project-a",
      parent_id: parent.id,
    });

    const pastedParent = await taskMutations.duplicate(parent as Task, {
      project_id: "project-b",
    });

    const pastedChild = mockStore.getSubtasks(pastedParent.id)[0];
    expect(pastedParent.project_id).toBe("project-b");
    // Subtasks keep the source's own project, since overrides only target
    // the pasted root — see toDuplicatePayload in task.ts.
    expect(pastedChild.project_id).toBe("project-a");
  });
});
