import { describe, it, expect } from "vitest";
import { parseMicrosoftTasksJson, parseOutlookTasksCsv } from "../parser";

describe("Microsoft Tasks JSON Ingress Parser (parseMicrosoftTasksJson)", () => {
  it("throws for empty, whitespace, or invalid JSON", () => {
    expect(() => parseMicrosoftTasksJson("")).toThrow(/empty/i);
    expect(() => parseMicrosoftTasksJson("   ")).toThrow(/empty/i);
    expect(() => parseMicrosoftTasksJson("{ invalid json }")).toThrow(/JSON/i);
  });

  it("handles UTF-8 BOM cleanly", () => {
    const rawWithBom =
      "\uFEFF" +
      JSON.stringify({
        lists: [
          {
            id: "list-1",
            displayName: "My Tasks",
            wellknownListName: "defaultList",
            tasks: [{ id: "t1", title: "Task 1" }],
          },
        ],
      });
    const parsed = parseMicrosoftTasksJson(rawWithBom);
    expect(parsed.lists).toHaveLength(1);
    expect(parsed.lists[0].displayName).toBe("My Tasks");
    expect(parsed.tasksByListId["list-1"]).toHaveLength(1);
  });

  it("parses { lists: [...] } envelope with nested tasks", () => {
    const payload = JSON.stringify({
      lists: [
        {
          id: "list-default",
          displayName: "Tasks",
          wellknownListName: "defaultList",
          tasks: [
            {
              id: "t1",
              title: "Buy groceries",
              importance: "high",
              checklistItems: [
                { id: "step-1", displayName: "Eggs", isChecked: true },
              ],
            },
          ],
        },
        {
          id: "list-work",
          displayName: "Work",
          wellknownListName: "none",
          tasks: [
            {
              id: "t2",
              title: "Deploy release",
              importance: "normal",
            },
          ],
        },
      ],
    });

    const parsed = parseMicrosoftTasksJson(payload);
    expect(parsed.lists).toHaveLength(2);
    expect(parsed.lists[0].wellknownListName).toBe("defaultList");
    expect(parsed.tasksByListId["list-default"]).toHaveLength(1);
    expect(parsed.tasksByListId["list-default"][0].checklistItems).toHaveLength(
      1,
    );
    expect(parsed.tasksByListId["list-work"]).toHaveLength(1);
  });

  it("parses Graph API { value: [...] } response for task lists", () => {
    const payload = JSON.stringify({
      "@odata.context":
        "https://graph.microsoft.com/v1.0/$metadata#users('id')/todo/lists",
      value: [
        {
          id: "l1",
          displayName: "Tasks",
          isOwner: true,
          isShared: false,
          wellknownListName: "defaultList",
          tasks: [{ id: "t1", title: "Task in default list" }],
        },
        {
          id: "l2",
          displayName: "Personal",
          wellknownListName: "none",
        },
      ],
    });

    const parsed = parseMicrosoftTasksJson(payload);
    expect(parsed.lists).toHaveLength(2);
    expect(parsed.lists[0].id).toBe("l1");
    expect(parsed.lists[1].id).toBe("l2");
    expect(parsed.tasksByListId["l1"]).toHaveLength(1);
  });

  it("parses Graph API { value: [...] } response for tasks in a single list", () => {
    const payload = JSON.stringify({
      "@odata.context":
        "https://graph.microsoft.com/v1.0/$metadata#users('id')/todo/lists('list-1')/tasks",
      value: [
        {
          id: "t1",
          title: "Standalone Task 1",
          importance: "high",
          status: "completed",
        },
        {
          id: "t2",
          title: "Standalone Task 2",
          importance: "normal",
          status: "notStarted",
        },
      ],
    });

    const parsed = parseMicrosoftTasksJson(payload);
    expect(parsed.lists).toHaveLength(1);
    expect(parsed.lists[0].wellknownListName).toBe("defaultList");
    expect(parsed.tasksByListId[parsed.lists[0].id]).toHaveLength(2);
  });

  it("parses raw Graph JSON array of tasks or lists", () => {
    const taskArray = JSON.stringify([
      { id: "t1", title: "Raw Array Task", importance: "low" },
    ]);
    const parsed = parseMicrosoftTasksJson(taskArray);
    expect(parsed.lists).toHaveLength(1);
    expect(parsed.lists[0].wellknownListName).toBe("defaultList");
    expect(parsed.tasksByListId[parsed.lists[0].id][0].title).toBe(
      "Raw Array Task",
    );
  });
});

describe("Classic Outlook CSV Ingress Parser (parseOutlookTasksCsv)", () => {
  it("throws for empty or header-only CSV", () => {
    expect(() => parseOutlookTasksCsv("")).toThrow(/empty/i);
    expect(() => parseOutlookTasksCsv("Subject,Due Date,Priority")).toThrow(
      /no tasks/i,
    );
  });

  it("parses standard Outlook CSV with ISO YYYY-MM-DD dates and category grouping", () => {
    const csv = `Subject,Due Date,Priority,Status,Categories,Body
"File Taxes",2026-11-21,High,Not Started,Finance,"Tax documents in folder"
"Call Dentist",2026-11-22,Normal,Completed,Health,"Annual checkup"
"Inbox Task Without Category",2026-11-23,Low,Not Started,,"General note"`;

    const dataset = parseOutlookTasksCsv(csv);

    expect(dataset.lists).toHaveLength(3); // Finance, Health, and default Tasks list

    const financeList = dataset.lists.find((l) => l.displayName === "Finance");
    expect(financeList).toBeDefined();
    expect(financeList?.wellknownListName).toBe("none");

    const financeTasks = dataset.tasksByListId[financeList!.id];
    expect(financeTasks).toHaveLength(1);
    expect(financeTasks[0].title).toBe("File Taxes");
    expect(financeTasks[0].importance).toBe("high");
    expect(financeTasks[0].status).toBe("notStarted");
    expect(financeTasks[0].dueDateTime?.dateTime).toContain("2026-11-21");
    expect(financeTasks[0].body?.content).toBe("Tax documents in folder");

    const healthList = dataset.lists.find((l) => l.displayName === "Health");
    expect(healthList).toBeDefined();
    const healthTasks = dataset.tasksByListId[healthList!.id];
    expect(healthTasks[0].status).toBe("completed");

    const defaultList = dataset.lists.find(
      (l) => l.wellknownListName === "defaultList",
    );
    expect(defaultList).toBeDefined();
    const defaultTasks = dataset.tasksByListId[defaultList!.id];
    expect(defaultTasks[0].title).toBe("Inbox Task Without Category");
  });

  it("parses European DD/MM/YYYY and US M/D/YYYY date formats", () => {
    const csv = `Subject,Due Date,Status
"European Date Task",25/12/2026,Not Started
"US Date Task",11/26/2026,Not Started
"Single Digit Month Task",4/5/2026,Not Started`;

    const dataset = parseOutlookTasksCsv(csv);
    const tasks = dataset.tasksByListId[dataset.lists[0].id];
    expect(tasks).toHaveLength(3);

    // 25/12/2026 -> 2026-12-25
    expect(tasks[0].dueDateTime?.dateTime).toBe("2026-12-25T00:00:00.000Z");

    // 11/26/2026 -> 2026-11-26
    expect(tasks[1].dueDateTime?.dateTime).toBe("2026-11-26T00:00:00.000Z");

    // 4/5/2026 (or 04/05/2026) -> year 2026
    expect(tasks[2].dueDateTime?.dateTime).toMatch(/^2026-\d{2}-\d{2}/);
  });

  it("handles multi-line quoted body text and escaped quotes", () => {
    const csv = `Subject,Body,Status
"Multi-line Task","Line 1
Line 2 with ""quotes""",Not Started`;

    const dataset = parseOutlookTasksCsv(csv);
    const tasks = dataset.tasksByListId[dataset.lists[0].id];
    expect(tasks).toHaveLength(1);
    expect(tasks[0].body?.content).toBe('Line 1\nLine 2 with "quotes"');
  });
});
