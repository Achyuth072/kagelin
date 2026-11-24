import { describe, it, expect } from "vitest";
import { parseTakeoutJson } from "@/lib/import/google-tasks/parser";

describe("Google Takeout JSON Parser (parseTakeoutJson)", () => {
  it("parses valid Google Takeout Tasks.json and assigns @default list to Inbox", () => {
    const json = JSON.stringify({
      kind: "tasks#tasks",
      items: [
        {
          id: "@default",
          name: "My Tasks",
          items: [
            {
              id: "task-1",
              title: "Pick up dry cleaning",
              notes: "Ticket #402",
              status: "needsAction",
              due: "2026-11-20T00:00:00.000Z",
              position: "00000000000000000001",
            },
          ],
        },
        {
          id: "work-list-id",
          name: "Work",
          items: [
            {
              id: "task-2",
              title: "Sprint review",
              status: "completed",
              completed: "2026-11-19T17:00:00.000Z",
              position: "00000000000000000002",
            },
          ],
        },
      ],
    });

    const dataset = parseTakeoutJson(json);

    expect(dataset.lists).toHaveLength(2);
    expect(dataset.lists[0].id).toBe("@default");
    expect(dataset.lists[0].title).toBe("My Tasks");
    expect(dataset.tasksByListId["@default"]).toHaveLength(1);
    expect(dataset.tasksByListId["@default"][0].title).toBe(
      "Pick up dry cleaning",
    );
    expect(dataset.tasksByListId["@default"][0].status).toBe("needsAction");

    expect(dataset.lists[1].id).toBe("work-list-id");
    expect(dataset.lists[1].title).toBe("Work");
    expect(dataset.tasksByListId["work-list-id"]).toHaveLength(1);
    expect(dataset.tasksByListId["work-list-id"][0].status).toBe("completed");
  });

  it("normalizes list name or title containing '@default' to list id '@default'", () => {
    const json = JSON.stringify({
      items: [
        {
          id: "random-assigned-id",
          name: "@default",
          items: [{ id: "t1", title: "Task 1", status: "needsAction" }],
        },
      ],
    });

    const dataset = parseTakeoutJson(json);
    expect(dataset.lists[0].id).toBe("@default");
    expect(dataset.lists[0].title).toBe("Inbox");
    expect(dataset.tasksByListId["@default"]).toHaveLength(1);
  });

  it("filters out deleted tasks (deleted === true)", () => {
    const json = JSON.stringify({
      items: [
        {
          id: "list-1",
          name: "Shopping",
          items: [
            { id: "active-1", title: "Apples", status: "needsAction" },
            {
              id: "deleted-1",
              title: "Bananas",
              status: "needsAction",
              deleted: true,
            },
          ],
        },
      ],
    });

    const dataset = parseTakeoutJson(json);
    expect(dataset.tasksByListId["list-1"]).toHaveLength(1);
    expect(dataset.tasksByListId["list-1"][0].id).toBe("active-1");
  });

  it("handles empty lists safely", () => {
    const json = JSON.stringify({
      items: [{ id: "empty-list", name: "Empty List" }],
    });

    const dataset = parseTakeoutJson(json);
    expect(dataset.lists).toHaveLength(1);
    expect(dataset.tasksByListId["empty-list"]).toEqual([]);
  });

  it("throws descriptive error on malformed JSON or empty string", () => {
    expect(() => parseTakeoutJson("")).toThrow(/empty/i);
    expect(() => parseTakeoutJson("   ")).toThrow(/empty/i);
    expect(() => parseTakeoutJson("{ not valid json }")).toThrow(
      /invalid json/i,
    );
  });

  it("throws descriptive error when JSON payload is not an object or lacks items", () => {
    expect(() => parseTakeoutJson("null")).toThrow(/invalid/i);
    expect(() => parseTakeoutJson("[]")).toThrow(/invalid/i);
    expect(() => parseTakeoutJson('"hello"')).toThrow(/invalid/i);
  });
});
