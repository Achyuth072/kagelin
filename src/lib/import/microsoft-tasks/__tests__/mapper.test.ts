import { describe, it, expect } from "vitest";
import {
  parseMicrosoftTaskDueDate,
  mapMicrosoftTaskList,
  mapMicrosoftTasksToKagelin,
} from "../mapper";
import type { MicrosoftTaskResource, MicrosoftTasksDataset } from "../types";

describe("Microsoft Tasks Timezone Mapper (parseMicrosoftTaskDueDate)", () => {
  it("anchors Microsoft Graph UTC midnight timestamps directly to UTC midnight", () => {
    expect(
      parseMicrosoftTaskDueDate({
        dateTime: "2026-11-21T00:00:00.0000000",
        timeZone: "UTC",
      }),
    ).toBe("2026-11-21T00:00:00.000Z");
  });

  it("anchors raw ISO string timestamps to UTC midnight", () => {
    expect(parseMicrosoftTaskDueDate("2026-11-21T00:00:00.0000000")).toBe(
      "2026-11-21T00:00:00.000Z",
    );
    expect(parseMicrosoftTaskDueDate("2026-11-21T00:00:00.000Z")).toBe(
      "2026-11-21T00:00:00.000Z",
    );
  });

  it("normalizes date-only strings without time component to UTC midnight", () => {
    expect(parseMicrosoftTaskDueDate("2026-11-21")).toBe(
      "2026-11-21T00:00:00.000Z",
    );
  });

  it("preserves calendar date regardless of positive UTC offset (e.g. UTC+8)", () => {
    expect(parseMicrosoftTaskDueDate("2026-11-21T14:30:00+08:00")).toBe(
      "2026-11-21T00:00:00.000Z",
    );
  });

  it("preserves calendar date regardless of negative UTC offset (e.g. UTC-5)", () => {
    expect(parseMicrosoftTaskDueDate("2026-11-21T01:15:00-05:00")).toBe(
      "2026-11-21T00:00:00.000Z",
    );
  });

  it("handles leading and trailing whitespace safely", () => {
    expect(parseMicrosoftTaskDueDate("  2026-11-21T00:00:00.0000000  ")).toBe(
      "2026-11-21T00:00:00.000Z",
    );
  });

  it("returns undefined for null, undefined, empty, or non-matching strings", () => {
    expect(parseMicrosoftTaskDueDate(null)).toBeUndefined();
    expect(parseMicrosoftTaskDueDate(undefined)).toBeUndefined();
    expect(parseMicrosoftTaskDueDate("")).toBeUndefined();
    expect(parseMicrosoftTaskDueDate("   ")).toBeUndefined();
    expect(parseMicrosoftTaskDueDate("invalid-date")).toBeUndefined();
    expect(parseMicrosoftTaskDueDate({ dateTime: "" })).toBeUndefined();
  });
});

describe("Microsoft Tasks Mapper (mapMicrosoftTaskList & mapMicrosoftTasksToKagelin)", () => {
  it("maps basic task fields: title to content, priority normalization, and due date", () => {
    const rawTasks: MicrosoftTaskResource[] = [
      {
        id: "task-1",
        title: "Submit Expense Report",
        importance: "high",
        status: "notStarted",
        dueDateTime: {
          dateTime: "2026-11-21T00:00:00.0000000",
          timeZone: "UTC",
        },
        body: {
          content: "Keep all receipts",
          contentType: "text",
        },
        checklistItems: [],
        isReminderOn: false,
      },
      {
        id: "task-2",
        title: "Low Priority Review",
        importance: "low",
        status: "notStarted",
        checklistItems: [],
        isReminderOn: false,
      },
      {
        id: "task-3",
        title: "Normal Priority Routine",
        importance: "normal",
        status: "notStarted",
        checklistItems: [],
        isReminderOn: false,
      },
    ];

    const mapped = mapMicrosoftTaskList(rawTasks, "list-1");
    expect(mapped).toHaveLength(3);

    // High importance -> 1 (P1)
    expect(mapped[0].content).toBe("Submit Expense Report");
    expect(mapped[0].priority).toBe(1);
    expect(mapped[0].dueDate).toBe("2026-11-21T00:00:00.000Z");
    expect(mapped[0].description).toBe("Keep all receipts");
    expect(mapped[0].parentId).toBeNull();
    expect(mapped[0].dayOrder).toBe(0);

    // Low & Normal importance -> 4 (P4)
    expect(mapped[1].priority).toBe(4);
    expect(mapped[1].dayOrder).toBe(1);
    expect(mapped[2].priority).toBe(4);
    expect(mapped[2].dayOrder).toBe(2);
  });

  it("sanitizes HTML body content using stripHtmlTags", () => {
    const rawTasks: MicrosoftTaskResource[] = [
      {
        id: "task-html",
        title: "HTML Notes Task",
        importance: "normal",
        status: "notStarted",
        body: {
          content: '<p>Hello <b>World</b></p><br><a href="#">Link</a>',
          contentType: "html",
        },
        checklistItems: [],
        isReminderOn: false,
      },
    ];

    const mapped = mapMicrosoftTaskList(rawTasks, "list-1");
    expect(mapped[0].description).toBe("Hello World\n\nLink");
  });

  it("handles completed tasks and timestamps correctly", () => {
    const rawTasks: MicrosoftTaskResource[] = [
      {
        id: "task-completed",
        title: "Completed Task",
        importance: "normal",
        status: "completed",
        completedDateTime: {
          dateTime: "2026-11-21T10:30:00.0000000",
          timeZone: "UTC",
        },
        lastModifiedDateTime: "2026-11-21T10:35:00.000Z",
        checklistItems: [],
        isReminderOn: false,
      },
      {
        id: "task-completed-fallback",
        title: "Completed Without completedDateTime",
        importance: "normal",
        status: "completed",
        completedDateTime: null,
        lastModifiedDateTime: "2026-11-21T11:00:00.000Z",
        checklistItems: [],
        isReminderOn: false,
      },
    ];

    const mapped = mapMicrosoftTaskList(rawTasks, "list-1");
    expect(mapped[0].isCompleted).toBe(true);
    expect(mapped[0].completedAt).toBe("2026-11-21T10:30:00.000Z");

    expect(mapped[1].isCompleted).toBe(true);
    expect(mapped[1].completedAt).toBe("2026-11-21T11:00:00.000Z");
  });

  it("converts checklistItems into child Steps with parent_id and contiguous dayOrder", () => {
    const rawTasks: MicrosoftTaskResource[] = [
      {
        id: "root-1",
        title: "Project Alpha Launch",
        importance: "high",
        status: "notStarted",
        checklistItems: [
          {
            id: "step-1-1",
            displayName: "Draft Announcement",
            isChecked: true,
            checkedDateTime: "2026-11-21T09:00:00.000Z",
          },
          {
            id: "step-1-2",
            displayName: "Notify Stakeholders",
            isChecked: false,
          },
        ],
        isReminderOn: false,
      },
      {
        id: "root-2",
        title: "Project Beta Review",
        importance: "normal",
        status: "notStarted",
        checklistItems: [
          {
            id: "step-2-1",
            displayName: "Review Metrics",
            isChecked: false,
          },
        ],
        isReminderOn: false,
      },
    ];

    const mapped = mapMicrosoftTaskList(rawTasks, "list-1");
    expect(mapped).toHaveLength(5);

    // Root 1
    expect(mapped[0].id).toBe("root-1");
    expect(mapped[0].parentId).toBeNull();
    expect(mapped[0].dayOrder).toBe(0);

    // Step 1-1
    expect(mapped[1].id).toBe("step-1-1");
    expect(mapped[1].parentId).toBe("root-1");
    expect(mapped[1].tempParentId).toBe("root-1");
    expect(mapped[1].content).toBe("Draft Announcement");
    expect(mapped[1].isCompleted).toBe(true);
    expect(mapped[1].completedAt).toBe("2026-11-21T09:00:00.000Z");
    expect(mapped[1].priority).toBe(4);
    expect(mapped[1].dayOrder).toBe(1);

    // Step 1-2
    expect(mapped[2].id).toBe("step-1-2");
    expect(mapped[2].parentId).toBe("root-1");
    expect(mapped[2].tempParentId).toBe("root-1");
    expect(mapped[2].content).toBe("Notify Stakeholders");
    expect(mapped[2].isCompleted).toBe(false);
    expect(mapped[2].dayOrder).toBe(2);

    // Root 2
    expect(mapped[3].id).toBe("root-2");
    expect(mapped[3].parentId).toBeNull();
    expect(mapped[3].tempParentId).toBeNull();
    expect(mapped[3].dayOrder).toBe(3);

    // Step 2-1
    expect(mapped[4].id).toBe("step-2-1");
    expect(mapped[4].parentId).toBe("root-2");
    expect(mapped[4].tempParentId).toBe("root-2");
    expect(mapped[4].dayOrder).toBe(4);
  });

  it("omits descriptions for flagged emails list per Spec L44", () => {
    const rawTasks: MicrosoftTaskResource[] = [
      {
        id: "email-task-1",
        title: "Follow up with client",
        importance: "normal",
        status: "notStarted",
        isReminderOn: false,
        checklistItems: [],
        body: {
          content: "Confidential email body details",
          contentType: "text",
        },
      },
    ];
    const mapped = mapMicrosoftTaskList(rawTasks, "flagged-list", {
      isFlaggedEmails: true,
    });
    expect(mapped[0].content).toBe("Follow up with client");
    expect(mapped[0].description).toBeNull();
  });

  it("maps full MicrosoftTasksDataset with multiple lists", () => {
    const dataset: MicrosoftTasksDataset = {
      lists: [
        {
          id: "default-list",
          displayName: "Tasks",
          wellknownListName: "defaultList",
          isOwner: true,
          isShared: false,
          tasks: [],
        },
        {
          id: "work-list",
          displayName: "Work",
          wellknownListName: "none",
          isOwner: true,
          isShared: false,
          tasks: [],
        },
      ],
      tasksByListId: {
        "default-list": [
          {
            id: "task-inbox",
            title: "Inbox Task",
            importance: "normal",
            status: "notStarted",
            checklistItems: [],
            isReminderOn: false,
          },
        ],
        "work-list": [
          {
            id: "task-work",
            title: "Work Task",
            importance: "high",
            status: "notStarted",
            checklistItems: [],
            isReminderOn: false,
          },
        ],
      },
    };

    const result = mapMicrosoftTasksToKagelin(dataset);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasksByListId["default-list"]).toHaveLength(1);
    expect(result.tasksByListId["work-list"]).toHaveLength(1);
    expect(result.tasksByListId["default-list"][0].content).toBe("Inbox Task");
    expect(result.tasksByListId["work-list"][0].content).toBe("Work Task");
  });
});
