import { describe, it, expect } from "vitest";
import { mapTodoistRowsToKagelin } from "@/lib/import/todoist/mapper";
import type { TodoistRow } from "@/lib/import/todoist/types";

describe("Todoist Domain Mapper & Hierarchy Restructuring", () => {
  it("maps priorities 1..4 1:1 and defaults empty to 4", () => {
    const rows: TodoistRow[] = [
      { type: "task", content: "P1 Task", priority: 1, indent: 1 },
      { type: "task", content: "P2 Task", priority: 2, indent: 1 },
      { type: "task", content: "P3 Task", priority: 3, indent: 1 },
      { type: "task", content: "P4 Task", priority: 4, indent: 1 },
      { type: "task", content: "Default Task", indent: 1 },
    ];

    const result = mapTodoistRowsToKagelin(rows);

    expect(result.tasks[0].priority).toBe(1);
    expect(result.tasks[1].priority).toBe(2);
    expect(result.tasks[2].priority).toBe(3);
    expect(result.tasks[3].priority).toBe(4);
    expect(result.tasks[4].priority).toBe(4);
  });

  it("prepends section names to task titles", () => {
    const rows: TodoistRow[] = [
      { type: "section", content: "Sprint 1", indent: 1 },
      { type: "task", content: "Fix bug", indent: 1 },
      { type: "task", content: "Write tests", indent: 1 },
      { type: "section", content: "Sprint 2", indent: 1 },
      { type: "task", content: "Deploy", indent: 1 },
    ];

    const result = mapTodoistRowsToKagelin(rows);

    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0].content).toBe("[Sprint 1] Fix bug");
    expect(result.tasks[1].content).toBe("[Sprint 1] Write tests");
    expect(result.tasks[2].content).toBe("[Sprint 2] Deploy");
  });

  it("appends task notes/comments and duration estimates to task description", () => {
    const rows: TodoistRow[] = [
      {
        type: "task",
        content: "Refactor engine",
        description: "Initial description.",
        duration: 45,
        durationUnit: "minute",
        indent: 1,
      },
      {
        type: "note",
        content: "Check performance before starting",
        author: "Alice (1234)",
        indent: 1,
      },
      {
        type: "note",
        content: "Also verify memory usage",
        indent: 1,
      },
    ];

    const result = mapTodoistRowsToKagelin(rows);

    expect(result.tasks).toHaveLength(1);
    const desc = result.tasks[0].description ?? "";
    expect(desc).toContain("Initial description.");
    expect(desc).toContain("⏱ Est: 45m");
    expect(desc).toContain("### Comments");
    expect(desc).toContain("- **Alice**: Check performance before starting");
    expect(desc).toContain("- Also verify memory usage");
  });

  it("attaches direct subtasks (INDENT=2) as steps to parent task", () => {
    const rows: TodoistRow[] = [
      { type: "task", content: "Parent Task", indent: 1 },
      { type: "task", content: "Subtask 1", indent: 2 },
      { type: "task", content: "Subtask 2", indent: 2 },
    ];

    const result = mapTodoistRowsToKagelin(rows);

    expect(result.tasks).toHaveLength(3);
    const parent = result.tasks[0];
    const subtask1 = result.tasks[1];
    const subtask2 = result.tasks[2];

    expect(parent.tempParentId).toBeNull();
    expect(subtask1.tempParentId).toBe(parent.tempId);
    expect(subtask1.content).toBe("Subtask 1");
    expect(subtask2.tempParentId).toBe(parent.tempId);
    expect(subtask2.content).toBe("Subtask 2");
  });

  it("flattens deeply nested subtasks (INDENT>=3) to root parent with indentation prefix", () => {
    const rows: TodoistRow[] = [
      { type: "task", content: "Root Task", indent: 1 },
      { type: "task", content: "Level 2 Subtask", indent: 2 },
      { type: "task", content: "Level 3 Subtask", indent: 3 },
      { type: "task", content: "Level 4 Subtask", indent: 4 },
    ];

    const result = mapTodoistRowsToKagelin(rows);

    expect(result.tasks).toHaveLength(4);
    const root = result.tasks[0];
    const lvl2 = result.tasks[1];
    const lvl3 = result.tasks[2];
    const lvl4 = result.tasks[3];

    expect(root.tempParentId).toBeNull();
    expect(lvl2.tempParentId).toBe(root.tempId);
    expect(lvl2.content).toBe("Level 2 Subtask");

    // Level 3 is flattened to root parent with '— ' prefix
    expect(lvl3.tempParentId).toBe(root.tempId);
    expect(lvl3.content).toBe("— Level 3 Subtask");

    // Level 4 is flattened to root parent with '—— ' prefix
    expect(lvl4.tempParentId).toBe(root.tempId);
    expect(lvl4.content).toBe("—— Level 4 Subtask");
  });

  it("promotes subtasks with explicit dates or priorities to top-level tasks with breadcrumb titles", () => {
    const rows: TodoistRow[] = [
      { type: "task", content: "Project Plan", indent: 1 },
      {
        type: "task",
        content: "Urgent Subtask",
        priority: 1, // P1 -> promoted
        indent: 2,
      },
      {
        type: "task",
        content: "Dated Subtask",
        date: "2026-10-25", // explicit date -> promoted
        indent: 2,
      },
      {
        type: "task",
        content: "Normal Subtask", // P4, no date -> stays child step
        indent: 2,
      },
    ];

    const result = mapTodoistRowsToKagelin(rows);

    expect(result.tasks).toHaveLength(4);
    const parent = result.tasks[0];
    const urgentPromoted = result.tasks[1];
    const datedPromoted = result.tasks[2];
    const normalChild = result.tasks[3];

    expect(parent.tempParentId).toBeNull();

    // Promoted because of priority=1
    expect(urgentPromoted.tempParentId).toBeNull();
    expect(urgentPromoted.content).toBe("Project Plan > Urgent Subtask");
    expect(urgentPromoted.priority).toBe(1);

    // Promoted because of explicit date
    expect(datedPromoted.tempParentId).toBeNull();
    expect(datedPromoted.content).toBe("Project Plan > Dated Subtask");
    expect(datedPromoted.dueDate).toBeDefined();

    // Normal child stays under parent
    expect(normalChild.tempParentId).toBe(parent.tempId);
    expect(normalChild.content).toBe("Normal Subtask");
  });
});
