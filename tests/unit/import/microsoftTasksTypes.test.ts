import { describe, it, expect } from "vitest";
import {
  MicrosoftChecklistItemSchema,
  MicrosoftTaskBodySchema,
  MicrosoftDateTimeTimeZoneSchema,
  MicrosoftTaskResourceSchema,
  MicrosoftTaskListResourceSchema,
  MicrosoftTasksDatasetSchema,
} from "@/lib/import/microsoft-tasks/types";

describe("Microsoft Tasks Domain Schemas & Contracts", () => {
  describe("MicrosoftChecklistItemSchema", () => {
    it("validates a checklist item (Step)", () => {
      const item = {
        id: "step-1",
        displayName: "Subtask 1",
        isChecked: true,
        createdDateTime: "2026-11-21T10:00:00.000Z",
        checkedDateTime: "2026-11-21T10:05:00.000Z",
      };
      const parsed = MicrosoftChecklistItemSchema.parse(item);
      expect(parsed.id).toBe("step-1");
      expect(parsed.displayName).toBe("Subtask 1");
      expect(parsed.isChecked).toBe(true);
    });

    it("defaults isChecked to false", () => {
      const parsed = MicrosoftChecklistItemSchema.parse({
        id: "step-2",
        displayName: "Subtask 2",
      });
      expect(parsed.isChecked).toBe(false);
    });
  });

  describe("MicrosoftTaskBodySchema", () => {
    it("validates html body content", () => {
      const parsed = MicrosoftTaskBodySchema.parse({
        content: "<p>Important note</p>",
        contentType: "html",
      });
      expect(parsed.contentType).toBe("html");
      expect(parsed.content).toBe("<p>Important note</p>");
    });

    it("defaults to text and empty content", () => {
      const parsed = MicrosoftTaskBodySchema.parse({});
      expect(parsed.contentType).toBe("text");
      expect(parsed.content).toBe("");
    });
  });

  describe("MicrosoftDateTimeTimeZoneSchema", () => {
    it("validates datetime with default UTC timezone", () => {
      const parsed = MicrosoftDateTimeTimeZoneSchema.parse({
        dateTime: "2026-11-21T00:00:00.0000000",
      });
      expect(parsed.dateTime).toBe("2026-11-21T00:00:00.0000000");
      expect(parsed.timeZone).toBe("UTC");
    });
  });

  describe("MicrosoftTaskResourceSchema", () => {
    it("validates a full task resource", () => {
      const task = {
        id: "task-1",
        title: "Buy coffee",
        importance: "high" as const,
        status: "completed" as const,
        dueDateTime: {
          dateTime: "2026-11-21T00:00:00.0000000",
          timeZone: "UTC",
        },
        completedDateTime: {
          dateTime: "2026-11-21T11:00:00.0000000",
          timeZone: "UTC",
        },
        checklistItems: [
          {
            id: "step-1",
            displayName: "Grind beans",
            isChecked: true,
          },
        ],
      };
      const parsed = MicrosoftTaskResourceSchema.parse(task);
      expect(parsed.id).toBe("task-1");
      expect(parsed.title).toBe("Buy coffee");
      expect(parsed.importance).toBe("high");
      expect(parsed.status).toBe("completed");
      expect(parsed.checklistItems).toHaveLength(1);
    });

    it("applies sane defaults for minimal task", () => {
      const parsed = MicrosoftTaskResourceSchema.parse({ id: "task-min" });
      expect(parsed.title).toBe("Untitled Task");
      expect(parsed.importance).toBe("normal");
      expect(parsed.status).toBe("notStarted");
      expect(parsed.checklistItems).toEqual([]);
    });
  });

  describe("MicrosoftTaskListResourceSchema", () => {
    it("validates a task list resource", () => {
      const list = {
        id: "list-1",
        displayName: "Work Projects",
        wellknownListName: "defaultList" as const,
        tasks: [],
      };
      const parsed = MicrosoftTaskListResourceSchema.parse(list);
      expect(parsed.id).toBe("list-1");
      expect(parsed.displayName).toBe("Work Projects");
      expect(parsed.wellknownListName).toBe("defaultList");
    });
  });

  describe("MicrosoftTasksDatasetSchema", () => {
    it("validates full in-memory dataset", () => {
      const dataset = {
        lists: [
          {
            id: "list-1",
            displayName: "Tasks",
            wellknownListName: "defaultList" as const,
            tasks: [],
          },
        ],
        tasksByListId: {
          "list-1": [
            {
              id: "task-1",
              title: "Do work",
            },
          ],
        },
      };
      const parsed = MicrosoftTasksDatasetSchema.parse(dataset);
      expect(parsed.lists).toHaveLength(1);
      expect(parsed.tasksByListId["list-1"]).toHaveLength(1);
    });
  });
});
