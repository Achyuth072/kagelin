import { describe, it, expect } from "vitest";
import {
  mapTickTickTasks,
  parseTickTickDate,
  mapPriority,
} from "@/lib/import/ticktick/mapper";
import { parseTickTickRecurrence } from "@/lib/import/ticktick/recurrence";
import type { RawTickTickRow } from "@/lib/import/ticktick/types";

function createMockRow(
  overrides: Partial<RawTickTickRow> = {},
): RawTickTickRow {
  return {
    "Folder Name": "",
    "List Name": "Inbox",
    Title: "Sample Task",
    Tags: "",
    Content: "",
    "Is Check list": "0",
    "Start Date": "",
    "Due Date": "",
    Reminder: "",
    Repeat: "",
    Priority: "0",
    Status: "0",
    "Created Time": "2026-11-20T10:00:00+0000",
    "Completed Time": "",
    Order: "0",
    Timezone: "UTC",
    "Is All Day": "0",
    "Is Floating": "0",
    "Column Name": "",
    "Column Order": "0",
    "View Mode": "list",
    taskId: "task-root-1",
    parentId: "",
    ...overrides,
  };
}

describe("TickTick Priority Mapping (mapPriority)", () => {
  it("accurately maps inverted priorities 0/1/3/5 -> 4/3/2/1", () => {
    expect(mapPriority("0")).toBe(4);
    expect(mapPriority("1")).toBe(3);
    expect(mapPriority("3")).toBe(2);
    expect(mapPriority("5")).toBe(1);
    expect(mapPriority("unknown")).toBe(4);
    expect(mapPriority("")).toBe(4);
  });
});

describe("TickTick Recurrence Parser (parseTickTickRecurrence)", () => {
  it("parses DAILY recurrence with or without RRULE: prefix", () => {
    expect(parseTickTickRecurrence("RRULE:FREQ=DAILY;INTERVAL=1")).toEqual({
      freq: "DAILY",
      interval: 1,
    });
    expect(parseTickTickRecurrence("FREQ=DAILY;INTERVAL=3")).toEqual({
      freq: "DAILY",
      interval: 3,
    });
  });

  it("parses WEEKLY recurrence with intervals and BYDAY list", () => {
    const parsed = parseTickTickRecurrence(
      "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR",
    );
    expect(parsed).toEqual({
      freq: "WEEKLY",
      interval: 2,
      days: [1, 3, 5],
    });
  });

  it("parses MONTHLY and YEARLY recurrences", () => {
    expect(parseTickTickRecurrence("RRULE:FREQ=MONTHLY;INTERVAL=1")).toEqual({
      freq: "MONTHLY",
      interval: 1,
    });
    expect(parseTickTickRecurrence("FREQ=YEARLY;INTERVAL=1")).toEqual({
      freq: "YEARLY",
      interval: 1,
    });
  });

  it("parses single BYDAY day string and normalizes interval", () => {
    const parsed = parseTickTickRecurrence("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(parsed).toEqual({
      freq: "WEEKLY",
      interval: 1,
      days: [1],
    });
  });

  it("handles malformed RRULE syntax throwing exceptions gracefully", () => {
    expect(
      parseTickTickRecurrence("RRULE:FREQ=;INTERVAL=NaN;BYDAY=??;::"),
    ).toBeNull();
  });

  it("returns null for unsupported frequencies or invalid expressions", () => {
    expect(
      parseTickTickRecurrence("RRULE:FREQ=SECONDLY;INTERVAL=10"),
    ).toBeNull();
    expect(parseTickTickRecurrence("not-a-valid-rrule")).toBeNull();
    expect(parseTickTickRecurrence("")).toBeNull();
  });
});

describe("TickTick Date Normalization (parseTickTickDate)", () => {
  it("anchors all-day dates to UTC midnight without timezone shift", () => {
    expect(
      parseTickTickDate("2026-11-22T17:00:00+0000", { isAllDay: true }),
    ).toBe("2026-11-22T00:00:00.000Z");

    expect(parseTickTickDate("2026-11-22", { isAllDay: true })).toBe(
      "2026-11-22T00:00:00.000Z",
    );
  });

  it("normalizes timed timestamps to standard UTC ISO string", () => {
    expect(
      parseTickTickDate("2026-11-25T09:00:00+0000", { isAllDay: false }),
    ).toBe("2026-11-25T09:00:00.000Z");
  });

  it("returns null for empty or invalid date strings", () => {
    expect(parseTickTickDate("", { isAllDay: false })).toBeNull();
    expect(parseTickTickDate("   ", { isAllDay: true })).toBeNull();
    expect(parseTickTickDate("not-a-date", { isAllDay: false })).toBeNull();
  });
});

describe("TickTick Tasks Mapper (mapTickTickTasks)", () => {
  it("maps core fields: title, priority, dates, status, tags, and dayOrder", () => {
    const rows: RawTickTickRow[] = [
      createMockRow({
        taskId: "t1",
        Title: "Review Architecture",
        Priority: "5",
        "Start Date": "2026-11-25T09:00:00+0000",
        "Due Date": "2026-11-25T11:00:00+0000",
        Status: "1",
        "Completed Time": "2026-11-25T10:30:00+0000",
        Tags: "tech,core",
        Order: "2",
        "Folder Name": "Engineering",
        "List Name": "Roadmap",
      }),
    ];

    const tasks = mapTickTickTasks(rows);
    expect(tasks).toHaveLength(1);
    const task = tasks[0];

    expect(task.content).toBe("Review Architecture");
    expect(task.priority).toBe(1);
    expect(task.doDate).toBe("2026-11-25T09:00:00.000Z");
    expect(task.dueDate).toBe("2026-11-25T11:00:00.000Z");
    expect(task.is_completed).toBe(true);
    expect(task.completedAt).toBe("2026-11-25T10:30:00.000Z");
    expect(task.description).toBe("#tech #core");
    expect(task.dayOrder).toBe(2);
    expect(task.folderName).toBe("Engineering");
    expect(task.listName).toBe("Roadmap");
  });

  it("falls back to 'Untitled Task' when Title is empty", () => {
    const rows = [createMockRow({ taskId: "t-empty", Title: "   " })];
    const tasks = mapTickTickTasks(rows);
    expect(tasks[0].content).toBe("Untitled Task");
  });

  it("marks archived tasks (Status: 2) as completed and annotates description", () => {
    const rows = [
      createMockRow({
        taskId: "t-archived",
        Status: "2",
        "Completed Time": "2026-11-20T12:00:00+0000",
      }),
    ];
    const tasks = mapTickTickTasks(rows);
    expect(tasks[0].is_completed).toBe(true);
    expect(tasks[0].description).toContain("[Status: Archived in TickTick]");
  });

  it("logs unsupported recurrence rules to description", () => {
    const rows = [
      createMockRow({
        taskId: "t-rrule",
        Repeat: "RRULE:FREQ=HOURLY;INTERVAL=2",
      }),
    ];
    const tasks = mapTickTickTasks(rows);
    expect(tasks[0].recurrence).toBeNull();
    expect(tasks[0].description).toContain(
      "> **Imported Recurrence:** `RRULE:FREQ=HOURLY;INTERVAL=2`",
    );
  });

  it("extracts checklist items on root tasks when Is Check list == '1'", () => {
    const rows = [
      createMockRow({
        taskId: "t-root",
        Title: "Grocery Shopping",
        "Is Check list": "1",
        Content: "▫ [ ] Milk\n▫ [x] Bread\nSupermarket on Main St",
      }),
    ];

    const tasks = mapTickTickTasks(rows);
    expect(tasks).toHaveLength(3);

    const root = tasks.find((t) => t.originalTaskId === "t-root")!;
    expect(root.tempParentId).toBeNull();
    expect(root.description).toBe("Supermarket on Main St");

    const step1 = tasks.find((t) => t.content === "Milk")!;
    expect(step1.tempParentId).toBe(root.tempId);
    expect(step1.originalParentId).toBe("t-root");
    expect(step1.is_completed).toBe(false);
    expect(step1.originalDepth).toBe(1);

    const step2 = tasks.find((t) => t.content === "Bread")!;
    expect(step2.tempParentId).toBe(root.tempId);
    expect(step2.originalParentId).toBe("t-root");
    expect(step2.is_completed).toBe(true);
    expect(step2.originalDepth).toBe(1);
  });

  it("preserves text notes intact when Is Check list == '0'", () => {
    const rows = [
      createMockRow({
        taskId: "t-note",
        Title: "Meeting Notes",
        "Is Check list": "0",
        Content: "- Discussed roadmap\n- Assigned tasks\n▫ Bullet point",
      }),
    ];

    const tasks = mapTickTickTasks(rows);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe(
      "- Discussed roadmap\n- Assigned tasks\n▫ Bullet point",
    );
  });

  it("enforces single-level depth-1 clamping and contextual breadcrumbs for deeper subtasks", () => {
    // Fixture hierarchy: A (depth 0) -> B (depth 1) -> C (depth 2) -> D (depth 3)
    const rows: RawTickTickRow[] = [
      createMockRow({ taskId: "A", Title: "Root Project", parentId: "" }),
      createMockRow({ taskId: "B", Title: "Feature Alpha", parentId: "A" }),
      createMockRow({
        taskId: "C",
        Title: "Backend API",
        parentId: "B",
        Content: "REST endpoint",
      }),
      createMockRow({
        taskId: "D",
        Title: "Auth middleware",
        parentId: "C",
      }),
    ];

    const tasks = mapTickTickTasks(rows);
    expect(tasks).toHaveLength(4);

    const taskA = tasks.find((t) => t.originalTaskId === "A")!;
    const taskB = tasks.find((t) => t.originalTaskId === "B")!;
    const taskC = tasks.find((t) => t.originalTaskId === "C")!;
    const taskD = tasks.find((t) => t.originalTaskId === "D")!;

    expect(taskA.tempParentId).toBeNull();
    expect(taskA.originalDepth).toBe(0);

    expect(taskB.tempParentId).toBe(taskA.tempId);
    expect(taskB.originalDepth).toBe(1);
    expect(taskB.description).toBeNull();

    expect(taskC.tempParentId).toBe(taskA.tempId);
    expect(taskC.originalDepth).toBe(2);
    expect(taskC.description).toContain(
      "[TickTick Context: Feature Alpha > Root Project]",
    );
    expect(taskC.description).toContain("REST endpoint");

    expect(taskD.tempParentId).toBe(taskA.tempId);
    expect(taskD.originalDepth).toBe(3);
    expect(taskD.description).toContain(
      "[TickTick Context: Backend API > Feature Alpha > Root Project]",
    );
  });

  it("retains checklists on child tasks as Markdown without spawning grandchildren", () => {
    const rows: RawTickTickRow[] = [
      createMockRow({
        taskId: "root-1",
        Title: "Prepare Launch",
        parentId: "",
      }),
      createMockRow({
        taskId: "child-1",
        Title: "Deploy Pipeline",
        parentId: "root-1",
        "Is Check list": "1",
        Content: "▫ [ ] Run migrations\n▫ [x] Verify DNS",
      }),
    ];

    const tasks = mapTickTickTasks(rows);
    expect(tasks).toHaveLength(2);

    const child = tasks.find((t) => t.originalTaskId === "child-1")!;
    expect(child.originalDepth).toBe(1);
    expect(child.description).toContain("- [ ] Run migrations");
    expect(child.description).toContain("- [x] Verify DNS");
  });
});
