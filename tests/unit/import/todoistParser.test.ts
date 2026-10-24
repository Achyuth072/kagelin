import { describe, it, expect } from "vitest";
import { parseTodoistCsv } from "@/lib/import/todoist/parser";

describe("Todoist CSV Parser", () => {
  it("parses the official Todoist CSV template with headers, tasks, and meta", () => {
    const csvContent = `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG
meta,view_style=list,,,,,,,,,,,,
,,,,,,,,,,,,,
task,Call that very important client,,1,1,,,today at 11:00,en,,30,minute,2025-03-31,en
note,Only available on Tuesdays and Thursdays,,,,,,,,,,,,
task,**Household chores**:,,4,1,,,,,,,,2025-02-24,en
task,Clean the house,,4,2,,,every month @ 13:00,en,,120,minute,,
task,Take out the trash,,3,2,,,every Friday,en,,,,,
`;

    const result = parseTodoistCsv(csvContent);

    expect(result.rows).toHaveLength(6);
    expect(result.rows[0]).toMatchObject({
      type: "meta",
      content: "view_style=list",
    });
    expect(result.rows[1]).toMatchObject({
      type: "task",
      content: "Call that very important client",
      priority: 1,
      indent: 1,
      duration: 30,
      durationUnit: "minute",
      date: "today at 11:00",
      deadline: "2025-03-31",
    });
    expect(result.rows[2]).toMatchObject({
      type: "note",
      content: "Only available on Tuesdays and Thursdays",
    });
  });

  it("handles UTF-8 BOM at the beginning of the file", () => {
    const csvContent = `\uFEFFTYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT\ntask,Test task,,1,1\n`;
    const result = parseTodoistCsv(csvContent);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].type).toBe("task");
    expect(result.rows[0].content).toBe("Test task");
  });

  it("handles semicolon delimiters used in European locales", () => {
    const csvContent = `TYPE;CONTENT;DESCRIPTION;PRIORITY;INDENT\ntask;Buy groceries;;2;1\n`;
    const result = parseTodoistCsv(csvContent);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].type).toBe("task");
    expect(result.rows[0].content).toBe("Buy groceries");
    expect(result.rows[0].priority).toBe(2);
  });

  it("handles multiline quoted fields in descriptions and notes", () => {
    const csvContent = `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT
task,"Task with quotes and ""nested quotes""","Line 1
Line 2
Line 3",1,1
`;
    const result = parseTodoistCsv(csvContent);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].content).toBe('Task with quotes and "nested quotes"');
    expect(result.rows[0].description).toBe("Line 1\nLine 2\nLine 3");
  });

  it("throws a descriptive error when CSV lacks required TYPE and CONTENT headers", () => {
    const invalidCsv = `FOO,BAR,BAZ\n1,2,3\n`;
    expect(() => parseTodoistCsv(invalidCsv)).toThrow(
      /Invalid Todoist CSV format/i,
    );
  });
});
