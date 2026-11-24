import { describe, it, expect } from "vitest";
import {
  parseTickTickCsv,
  extractChecklistItems,
} from "@/lib/import/ticktick/parser";
import { RawTickTickRowSchema } from "@/lib/import/ticktick/types";

describe("TickTick CSV Parser (parseTickTickCsv)", () => {
  it("throws for empty, whitespace, or invalid content", () => {
    expect(() => parseTickTickCsv("")).toThrow(/empty/i);
    expect(() => parseTickTickCsv("   \n\n  ")).toThrow(/empty/i);
    expect(() =>
      parseTickTickCsv("some,random,csv,without,ticktick,headers"),
    ).toThrow(/missing header row/i);
  });

  it("handles UTF-8 BOM cleanly", () => {
    const csv =
      '\uFEFF"Folder Name","List Name","Title","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"\n' +
      '"Personal","Groceries","Buy produce","","▫ [ ] Apples","1","","","","","0","0","2026-11-20T10:00:00+0000","","0","UTC","1","0","","0","list","t1",""';

    const rows = parseTickTickCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].Title).toBe("Buy produce");
    expect(rows[0].taskId).toBe("t1");
  });

  it("skips 1 to 4 line metadata preambles and blank delimiter lines", () => {
    const csv = `\"TickTick Backup\",,,,,,
\"Export Date: 2026-11-21\",,,,,,
\"Version: 6.0\",,,,,,
,,,,,,
\"Folder Name\",\"List Name\",\"Title\",\"Tags\",\"Content\",\"Is Check list\",\"Start Date\",\"Due Date\",\"Reminder\",\"Repeat\",\"Priority\",\"Status\",\"Created Time\",\"Completed Time\",\"Order\",\"Timezone\",\"Is All Day\",\"Is Floating\",\"Column Name\",\"Column Order\",\"View Mode\",\"taskId\",\"parentId\"
\"Personal\",\"Groceries\",\"Apples\",\"fruit\",\"Crunchy\",\"0\",\"\",\"2026-11-22T17:00:00+0000\",\"\",\"\",\"0\",\"0\",\"2026-11-20T10:00:00+0000\",\"\",\"0\",\"UTC\",\"1\",\"0\",\"\",\"0\",\"list\",\"task-1\",\"\"`;

    const rows = parseTickTickCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].Title).toBe("Apples");
    expect(rows[0]["Folder Name"]).toBe("Personal");
    expect(rows[0]["List Name"]).toBe("Groceries");
    expect(rows[0].Tags).toBe("fruit");
    expect(rows[0].taskId).toBe("task-1");
  });

  it("handles multiline records, escaped quotes, and Unicode characters", () => {
    const csv = `"Folder Name","List Name","Title","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"
"Work","Sprint","Plan ""Q4"" Review","planning,q4","▫ [ ] Review KPIs
▫ [x] Sync with team
Notes: ""Urgent""","1","2026-11-25T09:00:00+0000","2026-11-25T11:00:00+0000","","RRULE:FREQ=WEEKLY;INTERVAL=1","3","0","2026-11-18T14:30:00+0000","","1","America/New_York","0","0","","0","list","task-multi",""`;

    const rows = parseTickTickCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].Title).toBe('Plan "Q4" Review');
    expect(rows[0].Content).toContain(
      '▫ [ ] Review KPIs\n▫ [x] Sync with team\nNotes: "Urgent"',
    );
  });

  it("handles Windows CRLF line endings", () => {
    const csv =
      '"Folder Name","List Name","Title","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"\r\n' +
      '"Personal","Groceries","Milk","","","0","","","","","0","0","","","0","","0","0","","0","list","t-crlf",""\r\n';

    const rows = parseTickTickCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].taskId).toBe("t-crlf");
  });

  it("skips rows with missing or blank taskId, and handles rows with fewer columns", () => {
    const csv =
      '"Folder Name","List Name","Title","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"\n' +
      '"Personal","Groceries","No Task ID Row","","","0"\n' +
      '"Personal","Groceries","Valid Row","","","0","","","","","0","0","","","0","","0","0","","0","list","t-valid"\n';

    const rows = parseTickTickCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].taskId).toBe("t-valid");
    expect(rows[0].parentId).toBe("");
  });

  it("skips trailing blank lines", () => {
    const csv = `\"Folder Name\",\"List Name\",\"Title\",\"Tags\",\"Content\",\"Is Check list\",\"Start Date\",\"Due Date\",\"Reminder\",\"Repeat\",\"Priority\",\"Status\",\"Created Time\",\"Completed Time\",\"Order\",\"Timezone\",\"Is All Day\",\"Is Floating\",\"Column Name\",\"Column Order\",\"View Mode\",\"taskId\",\"parentId\"
\"\",\"Inbox\",\"Task 1\",\"\",\"\",\"0\",\"\",\"\",\"\",\"\",\"0\",\"0\",\"\",\"\",\"0\",\"\",\"0\",\"0\",\"\",\"0\",\"list\",\"t1\",\"\"
,,,,,,,,,,,,,,,,,,,,,,
   `;

    const rows = parseTickTickCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].taskId).toBe("t1");
  });
});

describe("RawTickTickRowSchema", () => {
  it("validates 23 columns and populates defaults for optional fields", () => {
    const parsed = RawTickTickRowSchema.parse({
      taskId: "unique-123",
      Title: "My Task",
    });

    expect(parsed.taskId).toBe("unique-123");
    expect(parsed.Title).toBe("My Task");
    expect(parsed["Folder Name"]).toBe("");
    expect(parsed["List Name"]).toBe("");
    expect(parsed["Is Check list"]).toBe("0");
    expect(parsed.Priority).toBe("0");
    expect(parsed.Status).toBe("0");
    expect(parsed.parentId).toBe("");
  });
});

describe("extractChecklistItems", () => {
  it("returns empty items and null description for empty or whitespace content", () => {
    expect(extractChecklistItems("")).toEqual({
      items: [],
      strippedDescription: null,
    });
    expect(extractChecklistItems("   \n\n  ")).toEqual({
      items: [],
      strippedDescription: null,
    });
  });

  it("extracts Unicode ▫ checklist items and distinguishes completion status", () => {
    const content = "▫ [ ] Milk\n▫ [x] Eggs\n▫ [X] Bread\n▫ Apples";
    const result = extractChecklistItems(content);

    expect(result.items).toEqual([
      { title: "Milk", is_completed: false },
      { title: "Eggs", is_completed: true },
      { title: "Bread", is_completed: true },
      { title: "Apples", is_completed: false },
    ]);
    expect(result.strippedDescription).toBeNull();
  });

  it("extracts Markdown checklist items (- [ ] / - [x])", () => {
    const content = "- [ ] First item\n- [x] Second item";
    const result = extractChecklistItems(content);

    expect(result.items).toEqual([
      { title: "First item", is_completed: false },
      { title: "Second item", is_completed: true },
    ]);
    expect(result.strippedDescription).toBeNull();
  });

  it("preserves non-checklist lines in strippedDescription", () => {
    const content =
      "General instructions:\n▫ [ ] Buy eggs\nMake sure they are organic\n▫ [x] Buy bread";
    const result = extractChecklistItems(content);

    expect(result.items).toEqual([
      { title: "Buy eggs", is_completed: false },
      { title: "Buy bread", is_completed: true },
    ]);
    expect(result.strippedDescription).toBe(
      "General instructions:\nMake sure they are organic",
    );
  });

  it("returns empty items and original content when no checklist items exist", () => {
    const content = "Just a standard paragraph with no checklist items.";
    const result = extractChecklistItems(content);

    expect(result.items).toHaveLength(0);
    expect(result.strippedDescription).toBe(
      "Just a standard paragraph with no checklist items.",
    );
  });
});
