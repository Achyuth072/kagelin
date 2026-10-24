import { describe, it, expect } from "vitest";
import { parseTodoistCsv } from "@/lib/import/todoist/parser";
import { mapTodoistRowsToKagelin } from "@/lib/import/todoist/mapper";
import {
  formatTodoistProjectCsv,
  TODOIST_CSV_COLUMNS,
} from "@/lib/export/todoistExport";
import type { Task } from "@/lib/types/task";

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-id",
    user_id: "user_1",
    project_id: null,
    parent_id: null,
    content: "Task title",
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
    created_at: "2025-03-01T00:00:00.000Z",
    updated_at: "2025-03-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Todoist 2025 Template & Help Center CSV Specification Compatibility", () => {
  const templateCsv = `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG
meta,view_style=list,,,,,,,,,,,,
,,,,,,,,,,,,,
task,Call that very important client,,1,1,,,today at 11:00,en,,30,minute,2025-03-31,en
note,Only available on Tuesdays and Thursdays,,,,,,,,,,,,
task,**Household chores**:,,4,1,,,,,,,,2025-02-24,en
task,Clean the house,,4,2,,,every month @ 13:00,en,,120,minute,,
task,Take out the trash,,3,2,,,every Friday,en,,,,,
`;

  describe("Header & Column Schema Alignment", () => {
    it("matches the canonical 14 columns defined in Todoist Help Center and the 2025 template", () => {
      const canonicalColumns = [
        "TYPE",
        "CONTENT",
        "DESCRIPTION",
        "PRIORITY",
        "INDENT",
        "AUTHOR",
        "RESPONSIBLE",
        "DATE",
        "DATE_LANG",
        "TIMEZONE",
        "DURATION",
        "DURATION_UNIT",
        "DEADLINE",
        "DEADLINE_LANG",
      ];
      const templateColumns = templateCsv.split(/\r?\n/)[0].split(",");

      expect(TODOIST_CSV_COLUMNS).toEqual(canonicalColumns);
      expect(templateColumns).toEqual(canonicalColumns);
    });
  });

  describe("Import Engine with 2025 Template", () => {
    it("successfully parses all meta, task, note, and blank rows", () => {
      const parsed = parseTodoistCsv(templateCsv);

      expect(parsed.meta.viewStyle).toBe("list");
      expect(parsed.rows).toHaveLength(6);

      const types = parsed.rows.map((r) => r.type);
      expect(types).toEqual(["meta", "task", "note", "task", "task", "task"]);
    });

    it("correctly maps dates, deadlines, durations, comments, and hierarchies into Kagelin tasks", () => {
      const parsed = parseTodoistCsv(templateCsv);
      const fixedRefDate = new Date("2025-03-01T10:00:00.000Z");
      const mapped = mapTodoistRowsToKagelin(parsed.rows, fixedRefDate);

      expect(mapped.tasks).toHaveLength(4);
      const [task1, task2, task3, task4] = mapped.tasks;

      // Task 1: "Call that very important client"
      // Has: priority 1, indent 1, date "today at 11:00", duration 30 min, deadline 2025-03-31, note attached
      expect(task1.content).toBe("Call that very important client");
      expect(task1.priority).toBe(1);
      expect(task1.indent).toBe(1);
      expect(task1.doDate).toContain("2025-03-01T11:00:00");
      expect(task1.dueDate).toBe("2025-03-31T00:00:00.000Z");
      expect(task1.description).toContain("⏱ Est: 30m");
      expect(task1.description).toContain("### Comments");
      expect(task1.description).toContain(
        "Only available on Tuesdays and Thursdays",
      );

      // Task 2: "**Household chores**:"
      // Has: priority 4, indent 1, deadline 2025-02-24
      expect(task2.content).toBe("**Household chores**:");
      expect(task2.priority).toBe(4);
      expect(task2.indent).toBe(1);
      expect(task2.dueDate).toBe("2025-02-24T00:00:00.000Z");
      expect(task2.doDate).toBeNull();

      // Task 3: "Clean the house"
      // Has: indent 2, recurrence "every month @ 13:00", duration 120 min
      // Promoted to top-level because of explicit date/recurrence with breadcrumb
      expect(task3.content).toBe("**Household chores**: > Clean the house");
      expect(task3.priority).toBe(4);
      expect(task3.recurrence).toEqual({
        freq: "MONTHLY",
        interval: 1,
        mode: "strict",
      });
      expect(task3.description).toContain("⏱ Est: 120m");

      // Task 4: "Take out the trash"
      // Has: priority 3, indent 2, recurrence "every Friday"
      // Promoted because of priority 3 and explicit recurrence
      expect(task4.content).toBe("**Household chores**: > Take out the trash");
      expect(task4.priority).toBe(3);
      expect(task4.recurrence).toEqual({
        freq: "WEEKLY",
        interval: 1,
        days: [5],
        mode: "strict",
      });
    });
  });

  describe("Export Engine Schema & Round-Trip Compatibility", () => {
    it("generates CSV with exact 14 columns, meta header, blank row, and valid formatting", () => {
      const mockTasks: Task[] = [
        createTask({
          id: "task-1",
          content: "Call that very important client",
          description:
            "⏱ Est: 30m\n\n---\n### Comments\n- Only available on Tuesdays and Thursdays",
          priority: 1,
          due_date: "2025-03-31T00:00:00.000Z",
          do_date: "2025-03-01T11:00:00.000Z",
        }),
        createTask({
          id: "task-2",
          content: "**Household chores**:",
          priority: 4,
          due_date: "2025-02-24T00:00:00.000Z",
          day_order: 1,
        }),
        createTask({
          id: "task-3",
          parent_id: "task-2",
          content: "Clean the house",
          description: "⏱ Est: 120m",
          priority: 4,
          due_date: "2025-03-01T00:00:00.000Z",
          day_order: 2,
          recurrence: { freq: "MONTHLY", interval: 1, mode: "strict" },
        }),
      ];

      const exported = formatTodoistProjectCsv({ tasks: mockTasks });
      const exportedLines = exported.trim().split(/\r?\n/);

      // Verify header matches
      expect(exportedLines[0]).toBe(TODOIST_CSV_COLUMNS.join(","));

      // Verify meta view_style
      expect(exportedLines[1]).toBe("meta,view_style=list,,,,,,,,,,,,");

      // Verify blank row spacer
      expect(exportedLines[2]).toBe(",,,,,,,,,,,,,");

      // Parse exported back with Todoist CSV parser
      const reParsed = parseTodoistCsv(exported);
      expect(reParsed.meta.viewStyle).toBe("list");

      const reParsedTasks = reParsed.rows.filter((r) => r.type === "task");
      expect(reParsedTasks).toHaveLength(3);
      const [reParsedTask1, reParsedTask2, reParsedTask3] = reParsedTasks;

      // Task 1: Check escaped description, dual date / deadline, priority
      expect(reParsedTask1.content).toBe("Call that very important client");
      expect(reParsedTask1.priority).toBe(1);
      expect(reParsedTask1.indent).toBe(1);
      expect(reParsedTask1.date).toBe("2025-03-01");
      expect(reParsedTask1.dateLang).toBe("en");
      expect(reParsedTask1.deadline).toBe("2025-03-31");
      expect(reParsedTask1.deadlineLang).toBe("en");
      expect(reParsedTask1.description).toContain("### Comments");

      // Task 2: Root task parent
      expect(reParsedTask2.content).toBe("**Household chores**:");
      expect(reParsedTask2.indent).toBe(1);

      // Task 3: Subtask of task 2 (INDENT = 2)
      expect(reParsedTask3.content).toBe("Clean the house");
      expect(reParsedTask3.indent).toBe(2);
      expect(reParsedTask3.date).toBe("every month");
      expect(reParsedTask3.dateLang).toBe("en");
      expect(reParsedTask3.deadline).toBe("2025-03-01");
      expect(reParsedTask3.deadlineLang).toBe("en");
    });
  });
});
