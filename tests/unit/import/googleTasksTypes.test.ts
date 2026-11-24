import { describe, it, expect } from "vitest";
import {
  GoogleTaskListResourceSchema,
  GoogleTaskResourceSchema,
  GoogleTasksDatasetSchema,
  GoogleTakeoutExportSchema,
  MappedGoogleTaskSchema,
} from "@/lib/import/google-tasks/types";

describe("Google Tasks Domain Schemas & Contracts", () => {
  describe("GoogleTaskListResourceSchema", () => {
    it("validates a standard task list resource", () => {
      const valid = {
        id: "@default",
        title: "My Tasks",
        updated: "2026-11-20T00:00:00.000Z",
      };
      const parsed = GoogleTaskListResourceSchema.parse(valid);
      expect(parsed.id).toBe("@default");
      expect(parsed.title).toBe("My Tasks");
    });

    it("rejects invalid task list resource missing required id or title", () => {
      expect(() =>
        GoogleTaskListResourceSchema.parse({ title: "No ID" }),
      ).toThrow();
      expect(() =>
        GoogleTaskListResourceSchema.parse({ id: "list-1" }),
      ).toThrow();
    });
  });

  describe("GoogleTaskResourceSchema", () => {
    it("validates a fully populated task resource", () => {
      const valid = {
        id: "task-123",
        title: "Buy groceries",
        notes: "Milk and bread",
        due: "2026-11-20T00:00:00.000Z",
        status: "needsAction" as const,
        completed: undefined,
        parent: "parent-task",
        position: "00000000000000000001",
        deleted: false,
        hidden: false,
      };
      const parsed = GoogleTaskResourceSchema.parse(valid);
      expect(parsed.id).toBe("task-123");
      expect(parsed.status).toBe("needsAction");
    });

    it("accepts completed task resource", () => {
      const valid = {
        id: "task-456",
        title: "Submit report",
        status: "completed" as const,
        completed: "2026-11-20T12:00:00.000Z",
      };
      const parsed = GoogleTaskResourceSchema.parse(valid);
      expect(parsed.status).toBe("completed");
      expect(parsed.completed).toBe("2026-11-20T12:00:00.000Z");
    });

    it("rejects task with invalid status", () => {
      expect(() =>
        GoogleTaskResourceSchema.parse({
          id: "task-789",
          title: "Invalid",
          status: "in_progress",
        }),
      ).toThrow();
    });
  });

  describe("GoogleTasksDatasetSchema", () => {
    it("validates a complete dataset with lists and tasksByListId", () => {
      const valid = {
        lists: [{ id: "@default", title: "My Tasks" }],
        tasksByListId: {
          "@default": [
            {
              id: "task-1",
              title: "Hello",
              status: "needsAction" as const,
            },
          ],
        },
      };
      const parsed = GoogleTasksDatasetSchema.parse(valid);
      expect(parsed.lists).toHaveLength(1);
      expect(parsed.tasksByListId["@default"]).toHaveLength(1);
    });
  });

  describe("GoogleTakeoutExportSchema", () => {
    it("validates Google Takeout JSON export payload structure", () => {
      const takeout = {
        kind: "tasks#tasks",
        items: [
          {
            id: "@default",
            name: "My Tasks",
            items: [
              {
                id: "item-1",
                title: "Call dentist",
                status: "needsAction",
              },
            ],
          },
        ],
      };
      const parsed = GoogleTakeoutExportSchema.parse(takeout);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.items?.[0].items).toHaveLength(1);
    });
  });

  describe("MappedGoogleTaskSchema", () => {
    it("validates a mapped task record ready for Kagelin ingestion", () => {
      const mapped = {
        id: "gtask-1",
        tempId: "gtask-1",
        parentId: null,
        tempParentId: null,
        content: "Buy groceries",
        description: "Organic only",
        dueDate: "2026-11-20T00:00:00.000Z",
        isCompleted: false,
        completedAt: null,
        dayOrder: 0,
        listId: "list-1",
        originalDepth: 0,
      };
      const parsed = MappedGoogleTaskSchema.parse(mapped);
      expect(parsed.content).toBe("Buy groceries");
      expect(parsed.dayOrder).toBe(0);
    });
  });
});
