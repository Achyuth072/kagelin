import { describe, it, expect } from "vitest";
import {
  parseGoogleTaskDueDate,
  mapGoogleTasksToKagelin,
  mapGoogleTaskList,
} from "../mapper";
import type { GoogleTaskResource, GoogleTasksDataset } from "../types";

describe("Google Tasks Timezone Mapper (parseGoogleTaskDueDate)", () => {
  it("anchors standard RFC 3339 UTC midnight timestamps directly to UTC midnight", () => {
    expect(parseGoogleTaskDueDate("2026-11-20T00:00:00.000Z")).toBe(
      "2026-11-20T00:00:00.000Z",
    );
  });

  it("normalizes date-only strings without time component to UTC midnight", () => {
    expect(parseGoogleTaskDueDate("2026-11-20")).toBe(
      "2026-11-20T00:00:00.000Z",
    );
  });

  it("preserves calendar date regardless of positive UTC offset (e.g. UTC+8)", () => {
    expect(parseGoogleTaskDueDate("2026-11-20T14:30:00+08:00")).toBe(
      "2026-11-20T00:00:00.000Z",
    );
  });

  it("preserves calendar date regardless of negative UTC offset (e.g. UTC-5)", () => {
    expect(parseGoogleTaskDueDate("2026-11-20T01:15:00-05:00")).toBe(
      "2026-11-20T00:00:00.000Z",
    );
  });

  it("handles leading and trailing whitespace safely", () => {
    expect(parseGoogleTaskDueDate("  2026-11-20T00:00:00.000Z  ")).toBe(
      "2026-11-20T00:00:00.000Z",
    );
  });

  it("returns undefined for null, undefined, empty, or non-matching strings", () => {
    expect(parseGoogleTaskDueDate(null)).toBeUndefined();
    expect(parseGoogleTaskDueDate(undefined)).toBeUndefined();
    expect(parseGoogleTaskDueDate("")).toBeUndefined();
    expect(parseGoogleTaskDueDate("   ")).toBeUndefined();
    expect(parseGoogleTaskDueDate("not-a-date")).toBeUndefined();
  });
});

describe("Google Tasks Hierarchy Mapper & DFS Ordering (mapGoogleTaskList & mapGoogleTasksToKagelin)", () => {
  it("orders tasks deterministically using pre-order DFS on sibling-scoped position strings", () => {
    const rawTasks: GoogleTaskResource[] = [
      {
        id: "root-2",
        title: "Root Task Two",
        position: "00000000000000000002",
        status: "needsAction",
      },
      {
        id: "child-2-1",
        title: "Child of Root 2",
        parent: "root-2",
        position: "00000000000000000001",
        status: "needsAction",
      },
      {
        id: "root-1",
        title: "Root Task One",
        position: "00000000000000000001",
        status: "needsAction",
      },
      {
        id: "child-1-2",
        title: "Second Child of Root 1",
        parent: "root-1",
        position: "00000000000000000002",
        status: "needsAction",
      },
      {
        id: "child-1-1",
        title: "First Child of Root 1",
        parent: "root-1",
        position: "00000000000000000001",
        status: "needsAction",
      },
    ];

    const mapped = mapGoogleTaskList(rawTasks, "test-list");

    expect(mapped).toHaveLength(5);
    // Pre-order DFS: Root 1 -> Child 1-1 -> Child 1-2 -> Root 2 -> Child 2-1
    expect(mapped.map((t) => t.id)).toEqual([
      "root-1",
      "child-1-1",
      "child-1-2",
      "root-2",
      "child-2-1",
    ]);

    // Check contiguous dayOrder assignment
    expect(mapped.map((t) => t.dayOrder)).toEqual([0, 1, 2, 3, 4]);
  });

  it("leaves task.content strictly identical to task.title verbatim (trimmed) for deduplication symmetry", () => {
    const rawTasks: GoogleTaskResource[] = [
      {
        id: "root-1",
        title: "  Plan Release  ",
        position: "00000000000000000001",
        status: "needsAction",
      },
      {
        id: "sub-1",
        title: "Draft release notes",
        parent: "root-1",
        position: "00000000000000000001",
        status: "needsAction",
      },
      {
        id: "sub-sub-1",
        title: "Review PR #123",
        parent: "sub-1",
        position: "00000000000000000001",
        status: "needsAction",
      },
    ];

    const mapped = mapGoogleTaskList(rawTasks, "list-1");

    expect(mapped[0].content).toBe("Plan Release");
    expect(mapped[1].content).toBe("Draft release notes");
    expect(mapped[2].content).toBe("Review PR #123");
  });

  it("attaches depth-1 subtasks directly to parent_id without breadcrumbs in description", () => {
    const rawTasks: GoogleTaskResource[] = [
      {
        id: "root-1",
        title: "Root Task",
        notes: "Root notes",
        position: "1",
        status: "needsAction",
      },
      {
        id: "child-1",
        title: "Depth 1 Subtask",
        notes: "Child notes",
        parent: "root-1",
        position: "1",
        status: "needsAction",
      },
    ];

    const mapped = mapGoogleTaskList(rawTasks, "list-1");

    expect(mapped[0].parentId).toBeNull();
    expect(mapped[0].tempParentId).toBeNull();
    expect(mapped[0].originalDepth).toBe(0);
    expect(mapped[0].description).toBe("Root notes");

    expect(mapped[1].parentId).toBe("root-1");
    expect(mapped[1].tempParentId).toBe("root-1");
    expect(mapped[1].originalDepth).toBe(1);
    expect(mapped[1].description).toBe("Child notes");
  });

  it("reparents depth >= 2 subtasks to root ancestor and embeds ancestry breadcrumb in description", () => {
    const rawTasks: GoogleTaskResource[] = [
      {
        id: "root",
        title: "Epic Project",
        position: "1",
        status: "needsAction",
      },
      {
        id: "stage-1",
        title: "Phase One",
        parent: "root",
        position: "1",
        status: "needsAction",
      },
      {
        id: "task-1",
        title: "Write Specs",
        notes: "Include performance targets",
        parent: "stage-1",
        position: "1",
        status: "needsAction",
      },
      {
        id: "subtask-1",
        title: "Benchmark QPS",
        parent: "task-1",
        position: "1",
        status: "needsAction",
      },
    ];

    const mapped = mapGoogleTaskList(rawTasks, "list-1");

    // Root
    expect(mapped[0].id).toBe("root");
    expect(mapped[0].parentId).toBeNull();
    expect(mapped[0].originalDepth).toBe(0);

    // Depth 1 (Phase One)
    expect(mapped[1].id).toBe("stage-1");
    expect(mapped[1].parentId).toBe("root");
    expect(mapped[1].originalDepth).toBe(1);
    expect(mapped[1].description).toBeNull();

    // Depth 2 (Write Specs) - reparented to root, breadcrumb Epic Project > Phase One
    expect(mapped[2].id).toBe("task-1");
    expect(mapped[2].parentId).toBe("root");
    expect(mapped[2].tempParentId).toBe("root");
    expect(mapped[2].originalDepth).toBe(2);
    expect(mapped[2].content).toBe("Write Specs");
    expect(mapped[2].description).toBe(
      "[Context: Epic Project > Phase One]\nInclude performance targets",
    );

    // Depth 3 (Benchmark QPS) - reparented to root, breadcrumb Epic Project > Phase One > Write Specs
    expect(mapped[3].id).toBe("subtask-1");
    expect(mapped[3].parentId).toBe("root");
    expect(mapped[3].tempParentId).toBe("root");
    expect(mapped[3].originalDepth).toBe(3);
    expect(mapped[3].content).toBe("Benchmark QPS");
    expect(mapped[3].description).toBe(
      "[Context: Epic Project > Phase One > Write Specs]",
    );
  });

  it("normalizes due dates, completed status, and completedAt accurately", () => {
    const rawTasks: GoogleTaskResource[] = [
      {
        id: "task-active",
        title: "Active Task",
        due: "2026-11-25T00:00:00.000Z",
        status: "needsAction",
      },
      {
        id: "task-done",
        title: "Done Task",
        due: "2026-11-20T18:00:00-08:00",
        status: "completed",
        completed: "2026-11-20T19:30:00.000Z",
      },
    ];

    const mapped = mapGoogleTaskList(rawTasks, "list-1");

    expect(mapped[0].dueDate).toBe("2026-11-25T00:00:00.000Z");
    expect(mapped[0].isCompleted).toBe(false);
    expect(mapped[0].completedAt).toBeNull();

    expect(mapped[1].dueDate).toBe("2026-11-20T00:00:00.000Z");
    expect(mapped[1].isCompleted).toBe(true);
    expect(mapped[1].completedAt).toBe("2026-11-20T19:30:00.000Z");
  });

  it("handles orphaned subtasks whose parent does not exist by treating them as roots", () => {
    const rawTasks: GoogleTaskResource[] = [
      {
        id: "orphan-1",
        title: "Orphaned Task",
        parent: "non-existent-parent",
        position: "1",
        status: "needsAction",
      },
    ];

    const mapped = mapGoogleTaskList(rawTasks, "list-1");

    expect(mapped).toHaveLength(1);
    expect(mapped[0].parentId).toBeNull();
    expect(mapped[0].originalDepth).toBe(0);
  });

  it("maps an entire GoogleTasksDataset across multiple lists", () => {
    const dataset: GoogleTasksDataset = {
      lists: [
        { id: "@default", title: "My Tasks" },
        { id: "list-2", title: "Project X" },
      ],
      tasksByListId: {
        "@default": [{ id: "t1", title: "Inbox task", status: "needsAction" }],
        "list-2": [{ id: "t2", title: "Project task", status: "completed" }],
      },
    };

    const result = mapGoogleTasksToKagelin(dataset);

    expect(result.tasks).toHaveLength(2);
    expect(result.tasksByListId["@default"]).toHaveLength(1);
    expect(result.tasksByListId["list-2"]).toHaveLength(1);
    expect(result.tasks[0].listId).toBe("@default");
    expect(result.tasks[1].listId).toBe("list-2");
  });
});
