import { describe, it, expect } from "vitest";
import {
  escapeCsvField,
  formatCsvRow,
  formatTodoistDate,
  formatTodoistRecurrence,
  mapTaskDates,
  formatTodoistProjectCsv,
  TODOIST_CSV_COLUMNS,
} from "@/lib/export/todoistExport";
import type { Task, Project } from "@/lib/types/task";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

describe("todoistExport - CSV formatting", () => {
  describe("escapeCsvField & formatCsvRow", () => {
    it("returns unquoted string if no special characters", () => {
      expect(escapeCsvField("Hello World")).toBe("Hello World");
      expect(escapeCsvField("task")).toBe("task");
      expect(escapeCsvField(1)).toBe("1");
    });

    it("handles null, undefined, and empty strings as empty", () => {
      expect(escapeCsvField(null)).toBe("");
      expect(escapeCsvField(undefined)).toBe("");
      expect(escapeCsvField("")).toBe("");
    });

    it("wraps fields with commas, newlines, or quotes in double quotes with RFC 4180 escaping", () => {
      expect(escapeCsvField("Buy milk, eggs")).toBe('"Buy milk, eggs"');
      expect(escapeCsvField('Say "hello"')).toBe('"Say ""hello"""');
      expect(escapeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(escapeCsvField("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
    });

    it("formats a CSV row with 14 columns", () => {
      const row = formatCsvRow([
        "task",
        "Title, with comma",
        'Description "quoted"',
        1,
        1,
        "",
        "",
        "2025-05-01",
        "en",
        "",
        "",
        "",
        "2025-05-10",
        "en",
      ]);
      expect(row).toBe(
        'task,"Title, with comma","Description ""quoted""",1,1,,,2025-05-01,en,,,,2025-05-10,en',
      );
    });
  });

  describe("formatTodoistDate", () => {
    it("formats plain YYYY-MM-DD string without timezone shifting", () => {
      expect(formatTodoistDate("2025-04-15")).toBe("2025-04-15");
    });

    it("resolves timed ISO strings to the local calendar date", () => {
      const evening = new Date(2026, 0, 5, 20, 0, 0);
      const afterMidnight = new Date(2026, 0, 5, 0, 30, 0);
      expect(formatTodoistDate(evening.toISOString())).toBe("2026-01-05");
      expect(formatTodoistDate(afterMidnight.toISOString())).toBe("2026-01-05");
    });

    it("formats Date instances using the local calendar date", () => {
      expect(formatTodoistDate(new Date(2025, 7, 9, 1, 30))).toBe("2025-08-09");
    });

    it("resolves the local date even when the UTC date part differs", () => {
      // Fixture crosses UTC midnight for the runner's offset; at UTC±0 the two behaviors coincide.
      const eastOfUtc = -new Date().getTimezoneOffset() > 0;
      const wallTime = eastOfUtc
        ? new Date(2026, 0, 5, 0, 30)
        : new Date(2026, 0, 5, 23, 30);
      expect(formatTodoistDate(wallTime.toISOString())).toBe("2026-01-05");
    });

    it("returns the raw string when nothing parseable remains", () => {
      expect(formatTodoistDate("2025-04-15T25:00")).toBe("2025-04-15T25:00");
    });

    it("returns empty string for null or undefined", () => {
      expect(formatTodoistDate(null)).toBe("");
      expect(formatTodoistDate(undefined)).toBe("");
    });
  });

  describe("formatTodoistRecurrence", () => {
    it("formats standard daily recurrence", () => {
      const rule: RecurrenceRule = {
        freq: "DAILY",
        interval: 1,
        mode: "strict",
      };
      expect(formatTodoistRecurrence(rule)).toBe("every day");
    });

    it("formats interval daily recurrence", () => {
      const rule: RecurrenceRule = { freq: "DAILY", interval: 3 };
      expect(formatTodoistRecurrence(rule)).toBe("every 3 days");
    });

    it("formats standard weekly recurrence", () => {
      const rule: RecurrenceRule = { freq: "WEEKLY", interval: 1 };
      expect(formatTodoistRecurrence(rule)).toBe("every week");
    });

    it("formats interval weekly recurrence", () => {
      const rule: RecurrenceRule = { freq: "WEEKLY", interval: 2 };
      expect(formatTodoistRecurrence(rule)).toBe("every 2 weeks");
    });

    it("formats weekly recurrence with specific days", () => {
      const rule: RecurrenceRule = {
        freq: "WEEKLY",
        interval: 1,
        days: [1, 5],
      };
      expect(formatTodoistRecurrence(rule)).toBe("every Mon, Fri");
    });

    it("sorts days of week in recurrence string", () => {
      const rule: RecurrenceRule = {
        freq: "WEEKLY",
        interval: 1,
        days: [5, 1, 3],
      };
      expect(formatTodoistRecurrence(rule)).toBe("every Mon, Wed, Fri");
    });

    it("formats monthly recurrence", () => {
      expect(formatTodoistRecurrence({ freq: "MONTHLY", interval: 1 })).toBe(
        "every month",
      );
      expect(formatTodoistRecurrence({ freq: "MONTHLY", interval: 6 })).toBe(
        "every 6 months",
      );
    });

    it("formats yearly recurrence", () => {
      expect(formatTodoistRecurrence({ freq: "YEARLY", interval: 1 })).toBe(
        "every year",
      );
      expect(formatTodoistRecurrence({ freq: "YEARLY", interval: 2 })).toBe(
        "every 2 years",
      );
    });

    it("formats flexible mode recurrence without prefix deviation", () => {
      expect(
        formatTodoistRecurrence({
          freq: "DAILY",
          interval: 1,
          mode: "flexible",
        }),
      ).toBe("every day");

      expect(
        formatTodoistRecurrence({
          freq: "WEEKLY",
          interval: 1,
          days: [1, 5],
          mode: "flexible",
        }),
      ).toBe("every Mon, Fri");
    });
  });

  describe("mapTaskDates", () => {
    it("maps both do_date and due_date to DATE and DEADLINE with en lang", () => {
      const result = mapTaskDates({
        do_date: "2025-06-01",
        due_date: "2025-06-10",
        recurrence: null,
      });
      expect(result).toEqual({
        date: "2025-06-01",
        dateLang: "en",
        deadline: "2025-06-10",
        deadlineLang: "en",
      });
    });

    it("maps single due_date to DATE with empty DEADLINE", () => {
      const result = mapTaskDates({
        do_date: null,
        due_date: "2025-06-10",
        recurrence: null,
      });
      expect(result).toEqual({
        date: "2025-06-10",
        dateLang: "en",
        deadline: "",
        deadlineLang: "",
      });
    });

    it("maps single do_date to DATE with empty DEADLINE", () => {
      const result = mapTaskDates({
        do_date: "2025-06-01",
        due_date: null,
        recurrence: null,
      });
      expect(result).toEqual({
        date: "2025-06-01",
        dateLang: "en",
        deadline: "",
        deadlineLang: "",
      });
    });

    it("maps recurrence to DATE and due_date to DEADLINE if both present", () => {
      const result = mapTaskDates({
        do_date: "2025-06-01",
        due_date: "2025-06-30",
        recurrence: { freq: "DAILY", interval: 1 },
      });
      expect(result).toEqual({
        date: "every day",
        dateLang: "en",
        deadline: "2025-06-30",
        deadlineLang: "en",
      });
    });

    it("returns all empty when no dates or recurrence present", () => {
      const result = mapTaskDates({
        do_date: null,
        due_date: null,
        recurrence: null,
      });
      expect(result).toEqual({
        date: "",
        dateLang: "",
        deadline: "",
        deadlineLang: "",
      });
    });
  });

  describe("formatTodoistProjectCsv", () => {
    const mockProject: Project = {
      id: "p1",
      user_id: "u1",
      name: "Work",
      color: "#ff0000",
      view_style: "list",
      is_inbox: false,
      is_archived: false,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    };

    const makeTask = (
      overrides: Partial<Task> & Pick<Task, "id" | "content" | "parent_id">,
    ): Task => ({
      user_id: "u1",
      project_id: "p1",
      description: null,
      priority: 4,
      due_date: null,
      do_date: null,
      is_evening: false,
      is_completed: false,
      completed_at: null,
      day_order: 1,
      recurrence: null,
      recurring_series_id: null,
      google_event_id: null,
      google_etag: null,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      ...overrides,
    });

    it("generates valid header and meta rows for an empty project", () => {
      const csv = formatTodoistProjectCsv({
        project: mockProject,
        tasks: [],
      });

      const lines = csv.split("\n");
      expect(lines[0]).toBe(TODOIST_CSV_COLUMNS.join(","));
      expect(lines[1]).toBe("meta,view_style=list,,,,,,,,,,,,");
      expect(lines[2]).toBe(",,,,,,,,,,,,,");
      expect(lines[3]).toBe(""); // trailing newline
    });

    it("always emits canonical meta,view_style=list row", () => {
      const csv = formatTodoistProjectCsv({
        project: { ...mockProject, view_style: "board" },
        tasks: [],
      });
      const lines = csv.split("\n");
      expect(lines[1]).toBe("meta,view_style=list,,,,,,,,,,,,");
    });

    it("excludes completed tasks", () => {
      const tasks: Task[] = [
        {
          id: "t1",
          user_id: "u1",
          project_id: "p1",
          parent_id: null,
          content: "Active Task",
          description: null,
          priority: 2,
          due_date: "2025-05-01",
          do_date: null,
          is_evening: false,
          is_completed: false,
          completed_at: null,
          day_order: 1,
          recurrence: null,
          recurring_series_id: null,
          google_event_id: null,
          google_etag: null,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "t2",
          user_id: "u1",
          project_id: "p1",
          parent_id: null,
          content: "Done Task",
          description: null,
          priority: 1,
          due_date: "2025-05-01",
          do_date: null,
          is_evening: false,
          is_completed: true,
          completed_at: "2025-05-01T12:00:00.000Z",
          day_order: 2,
          recurrence: null,
          recurring_series_id: null,
          google_event_id: null,
          google_etag: null,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ];

      const csv = formatTodoistProjectCsv({
        project: mockProject,
        tasks,
      });

      expect(csv).toContain("Active Task");
      expect(csv).not.toContain("Done Task");
    });

    it("formats subtasks with INDENT=2 immediately following parent with INDENT=1", () => {
      const tasks: Task[] = [
        {
          id: "parent-1",
          user_id: "u1",
          project_id: "p1",
          parent_id: null,
          content: "Parent Task 1",
          description: "Parent desc",
          priority: 1,
          due_date: null,
          do_date: null,
          is_evening: false,
          is_completed: false,
          completed_at: null,
          day_order: 1,
          recurrence: null,
          recurring_series_id: null,
          google_event_id: null,
          google_etag: null,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "sub-1-1",
          user_id: "u1",
          project_id: "p1",
          parent_id: "parent-1",
          content: "Subtask 1.1",
          description: null,
          priority: 4,
          due_date: null,
          do_date: null,
          is_evening: false,
          is_completed: false,
          completed_at: null,
          day_order: 1,
          recurrence: null,
          recurring_series_id: null,
          google_event_id: null,
          google_etag: null,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "parent-2",
          user_id: "u1",
          project_id: "p1",
          parent_id: null,
          content: "Parent Task 2",
          description: null,
          priority: 3,
          due_date: null,
          do_date: null,
          is_evening: false,
          is_completed: false,
          completed_at: null,
          day_order: 2,
          recurrence: null,
          recurring_series_id: null,
          google_event_id: null,
          google_etag: null,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ];

      const csv = formatTodoistProjectCsv({
        project: mockProject,
        tasks,
      });

      const lines = csv.split("\n").filter(Boolean);
      // lines[0]: header, lines[1]: meta, lines[2]: divider
      expect(lines[3]).toContain("task,Parent Task 1,Parent desc,1,1");
      expect(lines[4]).toContain("task,Subtask 1.1,,4,2");
      expect(lines[5]).toContain("task,Parent Task 2,,3,1");
    });

    it("promotes orphaned and nested subtasks to roots so every task is emitted", () => {
      const tasks: Task[] = [
        makeTask({ id: "root-1", parent_id: null, content: "Root Task" }),
        makeTask({ id: "child-1", parent_id: "root-1", content: "Subtask" }),
        makeTask({
          id: "grandchild-1",
          parent_id: "child-1",
          content: "Nested Step",
        }),
        makeTask({
          id: "orphan-1",
          parent_id: "done-1",
          content: "Orphaned Step",
          day_order: 2,
        }),
        makeTask({
          id: "done-1",
          parent_id: null,
          content: "Completed Parent",
          is_completed: true,
        }),
      ];

      const csv = formatTodoistProjectCsv({
        project: mockProject,
        tasks,
      });

      const lines = csv.split("\n").filter(Boolean);
      expect(lines).toHaveLength(7);
      const body = lines.slice(3).map((line) => line.split(",")[1]);
      expect(body.sort()).toEqual([
        "Nested Step",
        "Orphaned Step",
        "Root Task",
        "Subtask",
      ]);
    });
  });
});
