import { describe, it, expect } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import {
  sanitizeProjectFileName,
  generateTodoistZipFilename,
  buildTodoistExportZip,
} from "@/lib/export/todoistExport";
import { extractTodoistCsvFiles } from "@/lib/import/todoist/archive";
import { parseTodoistCsv } from "@/lib/import/todoist/parser";
import type { Project, Task } from "@/lib/types/task";

describe("todoistExport - Archive & ZIP generation", () => {
  describe("sanitizeProjectFileName", () => {
    it("replaces OS-forbidden characters with underscores", () => {
      expect(sanitizeProjectFileName('Work/Projects: "Home"? * < > | \\')).toBe(
        "Work_Projects_ _Home__ _ _ _ _ _",
      );
    });

    it("strips leading dots and trims whitespace", () => {
      expect(sanitizeProjectFileName("  ...hidden project  ")).toBe(
        "hidden project",
      );
    });

    it("falls back to 'Project' when empty or only illegal characters", () => {
      expect(sanitizeProjectFileName("")).toBe("Project");
      expect(sanitizeProjectFileName("   ")).toBe("Project");
      expect(sanitizeProjectFileName("...")).toBe("Project");
    });
  });

  describe("generateTodoistZipFilename / generateTodoistExportFilename", () => {
    it("generates filename with given date", () => {
      expect(generateTodoistZipFilename("2025-05-12")).toBe(
        "Todoist Export 2025-05-12.zip",
      );
    });

    it("generates filename with Date object", () => {
      expect(generateTodoistZipFilename(new Date("2025-05-12T12:00:00Z"))).toBe(
        "Todoist Export 2025-05-12.zip",
      );
    });
  });

  describe("buildTodoistExportZip", () => {
    const inboxProject: Project = {
      id: "inbox-1",
      user_id: "u1",
      name: "Inbox",
      color: "#808080",
      view_style: "list",
      is_inbox: true,
      is_archived: false,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    };

    const workProject: Project = {
      id: "work-1",
      user_id: "u1",
      name: "Work / Client",
      color: "#0000ff",
      view_style: "board",
      is_inbox: false,
      is_archived: false,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    };

    const emptyProject: Project = {
      id: "empty-1",
      user_id: "u1",
      name: "Empty Project",
      color: "#00ff00",
      view_style: "list",
      is_inbox: false,
      is_archived: false,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    };

    const archivedProject: Project = {
      id: "archived-1",
      user_id: "u1",
      name: "Archived Project",
      color: "#aaaaaa",
      view_style: "list",
      is_inbox: false,
      is_archived: true,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
    };

    const tasks: Task[] = [
      {
        id: "t-inbox",
        user_id: "u1",
        project_id: null,
        parent_id: null,
        content: "Inbox Task",
        description: "Inbox note",
        priority: 1,
        due_date: "2025-06-01",
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
        id: "t-work-root",
        user_id: "u1",
        project_id: "work-1",
        parent_id: null,
        content: "Deliver presentation",
        description: "Draft slides",
        priority: 2,
        due_date: "2025-06-15",
        do_date: "2025-06-10",
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
        id: "t-work-child",
        user_id: "u1",
        project_id: "work-1",
        parent_id: "t-work-root",
        content: "Rehearse speech",
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
        id: "t-completed",
        user_id: "u1",
        project_id: "work-1",
        parent_id: null,
        content: "Completed Work Task",
        description: null,
        priority: 1,
        due_date: null,
        do_date: null,
        is_evening: false,
        is_completed: true,
        completed_at: "2025-05-01T00:00:00.000Z",
        day_order: 2,
        recurrence: null,
        recurring_series_id: null,
        google_event_id: null,
        google_etag: null,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      },
    ];

    it("packages multi-project ZIP including Inbox, custom projects, and empty projects", () => {
      const zipBytes = buildTodoistExportZip({
        projects: [inboxProject, workProject, emptyProject, archivedProject],
        tasks,
      });

      const extracted = unzipSync(zipBytes);
      const fileNames = Object.keys(extracted).sort();

      expect(fileNames).toContain("Inbox.csv");
      expect(fileNames).toContain("Work _ Client.csv");
      expect(fileNames).toContain("Empty Project.csv");
      expect(fileNames).not.toContain("Archived Project.csv");

      // Verify archived project tasks are not routed to Inbox
      const inboxCsv = strFromU8(extracted["Inbox.csv"]);
      expect(inboxCsv).toContain("Inbox Task");

      // An active task belonging to an archived project should not be in Inbox.csv
      const archivedTask: Task = {
        id: "t-archived-proj",
        user_id: "u1",
        project_id: "archived-1",
        parent_id: null,
        content: "Archived Project Task",
        description: null,
        priority: 3,
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
      };

      const zipWithArchived = buildTodoistExportZip({
        projects: [inboxProject, workProject, archivedProject],
        tasks: [archivedTask],
      });
      const extractedWithArchived = unzipSync(zipWithArchived);
      const inboxWithArchivedCsv = strFromU8(
        extractedWithArchived["Inbox.csv"],
      );
      expect(inboxWithArchivedCsv).not.toContain("Archived Project Task");

      // Verify completed tasks excluded from Work CSV
      const workCsv = strFromU8(extracted["Work _ Client.csv"]);
      expect(workCsv).toContain("Deliver presentation");
      expect(workCsv).toContain("Rehearse speech");
      expect(workCsv).not.toContain("Completed Work Task");
      expect(workCsv).toContain("meta,view_style=list");
    });

    it("handles filename collisions with numeric suffix", () => {
      const dup1: Project = { ...workProject, id: "w1", name: "Client Work" };
      const dup2: Project = { ...workProject, id: "w2", name: "Client Work" };
      const dup3: Project = { ...workProject, id: "w3", name: "client work" };
      const inboxCustom: Project = { ...workProject, id: "w4", name: "Inbox" };

      const zipBytes = buildTodoistExportZip({
        projects: [inboxProject, dup1, dup2, dup3, inboxCustom],
        tasks: [],
      });

      const extracted = unzipSync(zipBytes);
      const fileNames = Object.keys(extracted);

      expect(fileNames).toContain("Inbox.csv");
      expect(fileNames).toContain("Client Work.csv");
      expect(fileNames).toContain("Client Work (2).csv");
      expect(fileNames).toContain("client work (3).csv");
      expect(fileNames).toContain("Inbox (2).csv");
    });

    it("round-trips correctly through Kagelin Todoist archive extractor and parser", () => {
      const recurringTask: Task = {
        id: "t-recur",
        user_id: "u1",
        project_id: "work-1",
        parent_id: null,
        content: "Weekly team sync",
        description: "Agenda in docs",
        priority: 1,
        due_date: "2025-12-31",
        do_date: null,
        is_evening: false,
        is_completed: false,
        completed_at: null,
        day_order: 1,
        recurrence: {
          freq: "WEEKLY",
          interval: 1,
          days: [1, 4],
        },
        recurring_series_id: null,
        google_event_id: null,
        google_etag: null,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      };

      const zipBytes = buildTodoistExportZip({
        projects: [inboxProject, workProject],
        tasks: [...tasks, recurringTask],
      });

      const files = extractTodoistCsvFiles(zipBytes);
      expect(files.length).toBe(2);

      const inboxFile = files.find((f) => f.isInbox);
      expect(inboxFile).toBeDefined();
      const parsedInbox = parseTodoistCsv(inboxFile!.csvContent);
      const inboxTasks = parsedInbox.rows.filter((r) => r.type === "task");
      expect(inboxTasks.length).toBe(1);
      expect(inboxTasks[0].content).toBe("Inbox Task");
      expect(inboxTasks[0].priority).toBe(1);
      expect(inboxTasks[0].indent).toBe(1);

      const workFile = files.find((f) => !f.isInbox);
      expect(workFile).toBeDefined();
      expect(workFile!.projectName).toBe("Work _ Client");
      const parsedWork = parseTodoistCsv(workFile!.csvContent);
      expect(parsedWork.meta.viewStyle).toBe("list");

      const taskRows = parsedWork.rows.filter((r) => r.type === "task");
      expect(taskRows.length).toBe(3); // Deliver presentation, Rehearse speech, Weekly team sync

      const presentationRow = taskRows.find(
        (r) => r.content === "Deliver presentation",
      );
      expect(presentationRow).toBeDefined();
      expect(presentationRow?.priority).toBe(2);
      expect(presentationRow?.indent).toBe(1);
      expect(presentationRow?.date).toBe("2025-06-10");
      expect(presentationRow?.deadline).toBe("2025-06-15");

      const rehearseRow = taskRows.find((r) => r.content === "Rehearse speech");
      expect(rehearseRow).toBeDefined();
      expect(rehearseRow?.indent).toBe(2);

      const syncRow = taskRows.find((r) => r.content === "Weekly team sync");
      expect(syncRow).toBeDefined();
      expect(syncRow?.date).toBe("every Mon, Thu");
      expect(syncRow?.deadline).toBe("2025-12-31");
    });
  });
});
