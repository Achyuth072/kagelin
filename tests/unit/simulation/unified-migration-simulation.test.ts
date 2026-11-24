import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mockStore } from "@/lib/mock/mock-store";

// TickTick imports
import { parseTickTickCsv } from "@/lib/import/ticktick/parser";
import { mapTickTickTasks } from "@/lib/import/ticktick/mapper";
import { planTickTickImport } from "@/lib/import/ticktick/plan";
import { executeTickTickImport } from "@/lib/import/ticktick/importTickTick";
import { fetchTickTickWorkspace } from "@/lib/import/ticktick/workspace";

// Google Tasks imports
import { parseTakeoutJson } from "@/lib/import/google-tasks/parser";
import { mapGoogleTaskList } from "@/lib/import/google-tasks/mapper";
import { planGoogleTasksImport } from "@/lib/import/google-tasks/plan";
import { executeGoogleTasksImport } from "@/lib/import/google-tasks/importGoogleTasks";
import { fetchGoogleTasksWorkspace } from "@/lib/import/google-tasks/workspace";

// Microsoft Tasks imports
import {
  parseMicrosoftTasksJson,
  parseOutlookTasksCsv,
} from "@/lib/import/microsoft-tasks/parser";
import { planMicrosoftTasksImport } from "@/lib/import/microsoft-tasks/plan";
import { executeMicrosoftTasksImport } from "@/lib/import/microsoft-tasks/executor";
import { fetchMicrosoftTasksWorkspace } from "@/lib/import/microsoft-tasks/workspace";

// Export helpers
import {
  formatHabitSummary,
  formatTodoistSummary,
  formatCalendarSummary,
} from "@/components/settings/MigrationExportTab";

describe("Unified Migration Simulation (TickTick, Google Tasks, Microsoft Tasks & Export)", () => {
  beforeEach(() => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.clearData();
  });

  afterEach(() => {
    mockStore.clearData();
    localStorage.removeItem("kanso_guest_mode");
  });

  describe("1. TickTick Universal Migration Simulation (.scratch/ticktick-import/spec.md)", () => {
    const REALISTIC_TICKTICK_CSV = `"TickTick Backup",,,,,,
"Export Date: 2026-11-23",,,,,,
"Version: 6.0",,,,,,
,,,,,,
"Folder Name","List Name","Title","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"
"","Inbox","Plan sprint kickoff","work,p1","Discuss Q1 deliverables","0","","2026-11-24T17:00:00+0000","","RRULE:FREQ=WEEKLY;BYDAY=MO","5","0","2026-11-20T09:00:00+0000","","0","UTC","1","0","","0","list","tt-root-1",""
"","Inbox","Book conference room","","Needs projector","0","","2026-11-24T17:00:00+0000","","","3","0","2026-11-20T09:05:00+0000","","1","UTC","1","0","","0","list","tt-sub-1","tt-root-1"
"","Inbox","Order projector cables","","HDMI and USB-C","0","","2026-11-24T17:00:00+0000","","","1","0","2026-11-20T09:10:00+0000","","2","UTC","1","0","","0","list","tt-sub-deep","tt-sub-1"
"Personal","Groceries","Weekend Grocery Run","shopping","▫ [ ] Organic Apples\n▫ [x] Greek Yogurt","1","","2026-11-25T17:00:00+0000","","","0","0","2026-11-21T10:00:00+0000","","0","UTC","1","0","","0","list","tt-root-2",""
"Personal","Groceries","Expired Milk Returned","","Handled at customer service","0","","2026-11-21T17:00:00+0000","","","1","1","2026-11-20T10:00:00+0000","2026-11-21T11:00:00+0000","1","UTC","1","0","","0","list","tt-root-3",""
`;

    it("parses, maps, clamps hierarchy, handles checklists, and imports into mockStore", async () => {
      // 1. Parse CSV (skipping preamble)
      const parsedRows = parseTickTickCsv(REALISTIC_TICKTICK_CSV);
      expect(parsedRows).toHaveLength(5);

      // 2. Map rows to Kagelin domain tasks
      const mappedTasks = mapTickTickTasks(parsedRows);

      // Verify Priority translations: TickTick 5 -> Kagelin 1 (High), 3 -> 2 (Med), 1 -> 3 (Low), 0 -> 4 (None)
      const sprintTask = mappedTasks.find(
        (t) => t.content === "Plan sprint kickoff",
      );
      expect(sprintTask?.priority).toBe(1);
      expect(sprintTask?.recurrence).toBeTruthy();

      const confTask = mappedTasks.find(
        (t) => t.content === "Book conference room",
      );
      expect(confTask?.priority).toBe(2);
      expect(confTask?.originalParentId).toBe("tt-root-1");

      // Deep subtask tt-sub-deep (depth >= 2) must be flattened to root ancestor tt-root-1 with breadcrumb
      const deepTask = mappedTasks.find(
        (t) => t.content === "Order projector cables",
      );
      expect(deepTask?.tempParentId).toBe(sprintTask?.tempId);
      expect(deepTask?.description).toContain(
        "[TickTick Context: Book conference room > Plan sprint kickoff]",
      );

      // Root task with embedded checklist items (▫ [ ], ▫ [x]) should extract steps as child tasks
      const rootGrocery = mappedTasks.find(
        (t) => t.content === "Weekend Grocery Run",
      );
      const appleStep = mappedTasks.find((t) => t.content === "Organic Apples");
      expect(appleStep).toBeTruthy();
      expect(appleStep?.tempParentId).toBe(rootGrocery?.tempId);
      expect(appleStep?.is_completed).toBe(false);

      const yogurtStep = mappedTasks.find((t) => t.content === "Greek Yogurt");
      expect(yogurtStep).toBeTruthy();
      expect(yogurtStep?.tempParentId).toBe(rootGrocery?.tempId);
      expect(yogurtStep?.is_completed).toBe(true);

      // 3. Plan import against empty workspace
      const workspace = await fetchTickTickWorkspace(true);
      const preview = planTickTickImport(mappedTasks, workspace);

      expect(preview.totalTasks).toBe(7);
      expect(preview.newProjectCount).toBe(1);

      // 4. Execute import in Guest mode
      const result = await executeTickTickImport(preview, {
        isGuest: true,
        includeCompleted: true,
      });

      expect(result.importedCount).toBe(7);
      expect(mockStore.getProjects()).toHaveLength(1);
      expect(mockStore.getTasks()).toHaveLength(7);
    });

    it("deduplicates root tasks and redirects new subtasks to existing root IDs on re-import", async () => {
      // Seed an existing root task with matching date to test fingerprint matching
      const existingRoot = mockStore.addTask({
        content: "Plan sprint kickoff",
        project_id: null,
        priority: 1,
        due_date: "2026-11-24T17:00:00.000Z",
      });

      const workspace = await fetchTickTickWorkspace(true);
      const parsedRows = parseTickTickCsv(REALISTIC_TICKTICK_CSV);
      const mappedTasks = mapTickTickTasks(parsedRows);
      const preview = planTickTickImport(mappedTasks, workspace);

      // Existing task should be detected as duplicate and skipped
      expect(preview.duplicateTasksSkipped).toBeGreaterThan(0);
      expect(preview.subtasksReassigned).toBeGreaterThan(0);

      // Commit import
      const result = await executeTickTickImport(preview, {
        isGuest: true,
        includeCompleted: true,
      });
      expect(result.importedCount).toBeGreaterThan(0);

      // Subtasks of tt-root-1 should now have parent_id pointing to existingRoot.id!
      const tasks = mockStore.getTasks();
      const child = tasks.find((t) => t.content === "Book conference room");
      expect(child?.parent_id).toBe(existingRoot.id);
    });
  });

  describe("2. Google Tasks Universal Migration Simulation (.scratch/google-tasks-import/spec.md)", () => {
    const REALISTIC_TAKEOUT_JSON = JSON.stringify({
      kind: "tasks#taskLists",
      items: [
        {
          kind: "tasks#taskList",
          id: "@default",
          title: "My Tasks",
          updated: "2026-11-23T10:00:00.000Z",
          items: [
            {
              kind: "tasks#task",
              id: "gt-root-1",
              title: "Pay Utility Bills",
              notes: "Electric and water",
              status: "needsAction",
              due: "2026-11-28T00:00:00.000Z",
            },
            {
              kind: "tasks#task",
              id: "gt-sub-1",
              title: "Electricity Board",
              parent: "gt-root-1",
              status: "completed",
              completed: "2026-11-22T08:00:00.000Z",
            },
            {
              kind: "tasks#task",
              id: "gt-sub-deep",
              title: "Download Receipt",
              parent: "gt-sub-1",
              status: "needsAction",
            },
          ],
        },
        {
          kind: "tasks#taskList",
          id: "gt-list-health",
          title: "Health & Fitness",
          items: [
            {
              kind: "tasks#task",
              id: "gt-root-2",
              title: "Annual health checkup",
              notes: "At City Hospital",
              status: "needsAction",
              due: "2026-12-01T00:00:00.000Z",
            },
          ],
        },
      ],
    });

    it("parses Takeout JSON, anchors UTC dates, maps default list to Inbox, and flattens depth >= 2", async () => {
      // 1. Parse Takeout JSON
      const dataset = parseTakeoutJson(REALISTIC_TAKEOUT_JSON);
      expect(dataset.lists).toHaveLength(2);
      expect(dataset.lists[0].id).toBe("@default");

      // Verify list mapping and hierarchy flattening via mapGoogleTaskList
      const defaultTasks = dataset.tasksByListId["@default"];
      const mappedDefault = mapGoogleTaskList(defaultTasks, "@default");
      expect(mappedDefault).toHaveLength(3);

      const deepSubtask = mappedDefault.find(
        (t) => t.content === "Download Receipt",
      );
      expect(deepSubtask?.originalDepth).toBe(2);
      expect(deepSubtask?.parentId).toBe("gt-root-1");
      expect(deepSubtask?.description).toContain(
        "[Context: Pay Utility Bills > Electricity Board]",
      );

      // Check timezone invariance: due date should be UTC midnight
      const utilityTask = mappedDefault.find(
        (t) => t.content === "Pay Utility Bills",
      );
      expect(utilityTask?.dueDate).toBe("2026-11-28T00:00:00.000Z");

      // 2. Plan and execute
      const workspace = await fetchGoogleTasksWorkspace(true);
      const preview = planGoogleTasksImport(dataset, workspace);

      expect(preview.totalTasks).toBe(4);
      expect(preview.rootTasksCount).toBe(2);
      expect(preview.subtasksCount).toBe(2);
      expect(preview.newProjectCount).toBe(1);

      // Verify the @default list mapped to Inbox project
      const inboxPlan = preview.projects.find((p) => p.status === "inbox");
      expect(inboxPlan).toBeTruthy();
      expect(inboxPlan?.tasks).toHaveLength(3);

      const result = await executeGoogleTasksImport(preview, { isGuest: true });
      expect(result.importedCount).toBe(4);
      expect(result.createdProjectCount).toBe(1);

      const savedTasks = mockStore.getTasks();
      expect(savedTasks).toHaveLength(4);
      const healthProject = mockStore
        .getProjects()
        .find((p) => p.name === "Health & Fitness");
      expect(healthProject).toBeTruthy();
      const healthTask = savedTasks.find(
        (t) => t.content === "Annual health checkup",
      );
      expect(healthTask?.project_id).toBe(healthProject?.id);
    });
  });

  describe("3. Microsoft Tasks (To Do) Universal Migration Simulation (.scratch/ms-tasks-import/spec.md)", () => {
    const REALISTIC_MS_GRAPH_JSON = JSON.stringify({
      lists: [
        {
          id: "ms-list-default",
          displayName: "Tasks",
          wellknownListName: "defaultList",
          isOwner: true,
          isShared: false,
          tasks: [
            {
              id: "ms-task-1",
              title: "Prepare Tax Returns",
              body: { content: "Include W2 and 1099-INT", contentType: "text" },
              importance: "high",
              status: "notStarted",
              dueDateTime: {
                dateTime: "2026-11-30T00:00:00.0000000",
                timeZone: "UTC",
              },
              checklistItems: [
                {
                  id: "step-1",
                  displayName: "Gather receipts",
                  isChecked: true,
                },
                {
                  id: "step-2",
                  displayName: "Submit electronically",
                  isChecked: false,
                },
              ],
            },
          ],
        },
        {
          id: "ms-list-home",
          displayName: "Home Renovation",
          wellknownListName: "none",
          isOwner: true,
          isShared: false,
          tasks: [
            {
              id: "ms-task-2",
              title: "Paint living room",
              importance: "normal",
              status: "completed",
              completedDateTime: {
                dateTime: "2026-11-20T14:00:00.000Z",
                timeZone: "UTC",
              },
              checklistItems: [],
            },
          ],
        },
      ],
    });

    const REALISTIC_OUTLOOK_CSV = `"Subject","Start Date","Due Date","Reminder","Categories","Status","Priority","% Complete","Total Work","Actual Work","Companies","Role","Owner"
"Review quarterly goals","11/20/2026","11/28/2026","No","Strategic Planning","In Progress","High","50%","0 hours","0 hours","","","User"
"File warranty claim","11/22/2026","11/25/2026","No","Personal","Completed","Normal","100%","0 hours","0 hours","","","User"
`;

    it("parses Graph JSON with checklist steps, maps defaultList to Inbox, and imports into mockStore", async () => {
      // 1. Parse Graph JSON
      const dataset = parseMicrosoftTasksJson(REALISTIC_MS_GRAPH_JSON);
      expect(dataset.lists).toHaveLength(2);

      // 2. Plan and execute
      const workspace = await fetchMicrosoftTasksWorkspace(true);
      const preview = planMicrosoftTasksImport(dataset, workspace);

      // In Microsoft Tasks preview model: rootTasksCount is 2, subtasksCount is 2, total all tasks is 4
      expect(preview.rootTasksCount).toBe(2);
      expect(preview.subtasksCount).toBe(2);
      expect(preview.tasks).toHaveLength(4);
      expect(preview.newProjectCount).toBe(1);

      // Verify default list maps to Inbox
      const inboxPlan = preview.projects.find((p) => p.status === "inbox");
      expect(inboxPlan).toBeTruthy();
      expect(inboxPlan?.tasks).toHaveLength(3); // 1 root + 2 steps

      const result = await executeMicrosoftTasksImport(preview, {
        includeCompleted: true,
      });
      expect(result.importedCount).toBe(4);

      const savedTasks = mockStore.getTasks();
      expect(savedTasks).toHaveLength(4);
      const rootTaskInStore = savedTasks.find(
        (t) => t.content === "Prepare Tax Returns",
      );
      expect(rootTaskInStore?.priority).toBe(1); // high importance -> priority 1
      const savedSteps = savedTasks.filter(
        (t) => t.parent_id === rootTaskInStore?.id,
      );
      expect(savedSteps).toHaveLength(2);
    });

    it("parses Outlook CSV, anchors US dates safely without timezone drift", () => {
      const dataset = parseOutlookTasksCsv(REALISTIC_OUTLOOK_CSV);
      // Outlook CSV organizes tasks into lists by Category
      expect(dataset.lists.length).toBeGreaterThanOrEqual(1);
      const allTasks = Object.values(dataset.tasksByListId).flat();
      expect(allTasks).toHaveLength(2);

      const quarterly = allTasks.find(
        (t) => t.title === "Review quarterly goals",
      );
      expect(quarterly?.importance).toBe("high");
      expect(quarterly?.dueDateTime?.dateTime).toBe("2026-11-28T00:00:00.000Z");

      const warranty = allTasks.find((t) => t.title === "File warranty claim");
      expect(warranty?.status).toBe("completed");
    });
  });

  describe("4. Export Simulation & Spec Non-Goal Alignment", () => {
    it("formats summary labels accurately for active user items", () => {
      expect(formatHabitSummary(0)).toBe("No habits to export");
      expect(formatHabitSummary(1)).toBe("1 habit ready to export");
      expect(formatHabitSummary(5)).toBe("5 habits ready to export");

      expect(formatTodoistSummary(0, 0)).toBe("No active tasks");
      expect(formatTodoistSummary(1, 0)).toBe("1 task");
      expect(formatTodoistSummary(8, 2)).toBe("8 tasks across 2 projects");

      expect(formatCalendarSummary(0)).toBe("No calendar events to export");
      expect(formatCalendarSummary(1)).toBe("1 event ready to export");
      expect(formatCalendarSummary(12)).toBe("12 events ready to export");
    });

    it("verifies export mechanisms correctly reflect the database state in Guest mode", () => {
      // Seed mock store with projects and tasks
      const proj = mockStore.addProject({
        name: "Work Projects",
        color: "#3b82f6",
        is_inbox: false,
        is_archived: false,
        view_style: "list",
      });
      mockStore.addTask({ content: "Active Task 1", project_id: proj.id });
      mockStore.addTask({ content: "Active Task 2", project_id: null });
      mockStore.addTask({
        content: "Completed Task",
        project_id: proj.id,
        is_completed: true,
      });

      const activeProjects = mockStore
        .getProjects()
        .filter((p) => !p.is_archived && !p.is_inbox);
      const activeTasks = mockStore.getTasks().filter((t) => !t.is_completed);

      expect(activeProjects).toHaveLength(1);
      expect(activeTasks).toHaveLength(2);

      const summary = formatTodoistSummary(
        activeTasks.length,
        activeProjects.length,
      );
      expect(summary).toBe("2 tasks across 1 project");
    });
  });
});
