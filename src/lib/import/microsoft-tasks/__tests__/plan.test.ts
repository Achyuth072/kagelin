import { describe, it, expect } from "vitest";
import { planMicrosoftTasksImport } from "../plan";
import type { MicrosoftTasksDataset, ExistingWorkspace } from "../types";
import { PROJECT_COLORS } from "@/lib/constants/colors";

function createDataset(
  lists: Array<{
    id: string;
    displayName: string;
    wellknownListName?: "none" | "defaultList" | "flaggedEmails" | "unknown";
  }>,
  tasksByListId: Record<
    string,
    Array<{
      id: string;
      title: string;
      status?:
        | "notStarted"
        | "inProgress"
        | "completed"
        | "waitingOnOthers"
        | "deferred";
      dueDateTime?: { dateTime: string; timeZone?: string };
      completedDateTime?: { dateTime: string; timeZone?: string };
      checklistItems?: Array<{
        id: string;
        displayName: string;
        isChecked?: boolean;
      }>;
    }>
  >,
): MicrosoftTasksDataset {
  return {
    lists: lists.map((l) => ({
      id: l.id,
      displayName: l.displayName,
      isOwner: true,
      isShared: false,
      wellknownListName: l.wellknownListName ?? "none",
      tasks: [],
    })),
    tasksByListId: Object.fromEntries(
      Object.entries(tasksByListId).map(([listId, tasks]) => [
        listId,
        tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status ?? "notStarted",
          dueDateTime: t.dueDateTime
            ? {
                dateTime: t.dueDateTime.dateTime,
                timeZone: t.dueDateTime.timeZone ?? "UTC",
              }
            : undefined,
          completedDateTime: t.completedDateTime
            ? {
                dateTime: t.completedDateTime.dateTime,
                timeZone: t.completedDateTime.timeZone ?? "UTC",
              }
            : undefined,
          checklistItems: (t.checklistItems ?? []).map((c) => ({
            id: c.id,
            displayName: c.displayName,
            isChecked: c.isChecked ?? false,
          })),
          importance: "normal" as const,
          isReminderOn: false,
        })),
      ]),
    ),
  };
}

describe("planMicrosoftTasksImport (Deduplication & Planning Engine)", () => {
  const emptyWorkspace: ExistingWorkspace = {
    projects: [],
    tasks: [],
  };

  it("plans fresh import into an empty workspace: assigns Inbox and new project", () => {
    const dataset = createDataset(
      [
        {
          id: "list-default",
          displayName: "Tasks",
          wellknownListName: "defaultList",
        },
        { id: "list-work", displayName: "Work Projects" },
      ],
      {
        "list-default": [
          {
            id: "task-1",
            title: "Buy groceries",
            dueDateTime: {
              dateTime: "2026-11-20T00:00:00.0000000",
              timeZone: "UTC",
            },
          },
        ],
        "list-work": [
          {
            id: "task-2",
            title: "Ship Kagelin v1",
            dueDateTime: {
              dateTime: "2026-11-25T00:00:00.0000000",
              timeZone: "UTC",
            },
            checklistItems: [
              { id: "step-1", displayName: "Write tests", isChecked: true },
            ],
          },
        ],
      },
    );

    const preview = planMicrosoftTasksImport(dataset, emptyWorkspace);

    expect(preview.totalLists).toBe(2);
    expect(preview.totalTasks).toBe(2); // 2 root tasks
    expect(preview.totalSteps).toBe(1); // 1 step
    expect(preview.totalCompleted).toBe(1); // step-1 is checked
    expect(preview.duplicatesCount).toBe(0);
    expect(preview.stepsReassigned).toBe(0);
    expect(preview.newProjectCount).toBe(1);
    expect(preview.mergedProjectCount).toBe(0);
    expect(preview.earliestDate).toBe("2026-11-20T00:00:00.000Z");
    expect(preview.latestDate).toBe("2026-11-25T00:00:00.000Z");

    const inboxPlan = preview.projects.find((p) => p.isInbox);
    expect(inboxPlan).toBeDefined();
    expect(inboxPlan?.status).toBe("inbox");
    expect(inboxPlan?.name).toBe("Inbox");
    expect(inboxPlan?.tasks).toHaveLength(1);

    const workPlan = preview.projects.find((p) => p.name === "Work Projects");
    expect(workPlan).toBeDefined();
    expect(workPlan?.action).toBe("create");
    expect(workPlan?.status).toBe("new");
    expect(workPlan?.existingProjectId).toBeNull();
    expect(PROJECT_COLORS.map((c) => c.hex)).toContain(workPlan?.color);
    expect(workPlan?.tasks).toHaveLength(2); // 1 root + 1 step
  });

  it("merges into existing workspace projects by normalized name (case-insensitive)", () => {
    const workspace: ExistingWorkspace = {
      projects: [
        { id: "proj-work-123", name: "work projects", is_inbox: false },
      ],
      tasks: [],
    };

    const dataset = createDataset(
      [{ id: "list-work", displayName: "Work Projects" }],
      {
        "list-work": [{ id: "task-1", title: "New Feature" }],
      },
    );

    const preview = planMicrosoftTasksImport(dataset, workspace);

    expect(preview.mergedProjectCount).toBe(1);
    expect(preview.newProjectCount).toBe(0);

    const workPlan = preview.projects[0];
    expect(workPlan.action).toBe("merge");
    expect(workPlan.status).toBe("merged");
    expect(workPlan.existingProjectId).toBe("proj-work-123");
  });

  it("deduplicates root tasks against workspace by (project_id, normalized_title, is_completed)", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "proj-1", name: "Chores", is_inbox: false }],
      tasks: [
        // Active task in Chores
        {
          id: "existing-task-active",
          content: "Clean kitchen",
          project_id: "proj-1",
          parent_id: null,
          is_completed: false,
        },
        // Completed task in Chores
        {
          id: "existing-task-done",
          content: "Wash car",
          project_id: "proj-1",
          parent_id: null,
          is_completed: true,
        },
      ],
    };

    const dataset = createDataset(
      [{ id: "list-chores", displayName: "Chores" }],
      {
        "list-chores": [
          // Matches active "Clean kitchen" -> DUPLICATE
          { id: "ms-1", title: "  clean kitchen  ", status: "notStarted" },
          // "Clean kitchen" but completed in MS -> NOT duplicate because completion differs!
          { id: "ms-2", title: "Clean kitchen", status: "completed" },
          // Matches completed "Wash car" -> DUPLICATE
          { id: "ms-3", title: "Wash car", status: "completed" },
          // "Wash car" active in MS -> NOT duplicate because completion differs!
          { id: "ms-4", title: "Wash car", status: "notStarted" },
        ],
      },
    );

    const preview = planMicrosoftTasksImport(dataset, workspace);

    expect(preview.duplicatesCount).toBe(2);
    expect(preview.totalTasks).toBe(2);

    const keptTitles = preview.projects[0].tasks.map((t) => ({
      title: t.content,
      completed: t.isCompleted,
    }));

    expect(keptTitles).toEqual([
      { title: "Clean kitchen", completed: true },
      { title: "Wash car", completed: false },
    ]);

    expect(preview.projects[0].parentRedirects["ms-1"]).toEqual({
      kind: "existing",
      taskId: "existing-task-active",
    });
    expect(preview.projects[0].parentRedirects["ms-3"]).toEqual({
      kind: "existing",
      taskId: "existing-task-done",
    });
  });

  it("redirects checklist Steps to existing Kagelin task when incoming root is duplicate", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "proj-1", name: "Roadmap", is_inbox: false }],
      tasks: [
        {
          id: "kagelin-root-100",
          content: "Implement OAuth",
          project_id: "proj-1",
          parent_id: null,
          is_completed: false,
        },
        // Already existing step in Kagelin
        {
          id: "kagelin-step-existing",
          content: "Exchange code",
          project_id: "proj-1",
          parent_id: "kagelin-root-100",
          is_completed: false,
        },
      ],
    };

    const dataset = createDataset(
      [{ id: "list-roadmap", displayName: "Roadmap" }],
      {
        "list-roadmap": [
          {
            id: "ms-root-1",
            title: "Implement OAuth",
            status: "notStarted",
            checklistItems: [
              // Duplicate of existing step in Kagelin -> skipped
              {
                id: "ms-step-dup",
                displayName: "Exchange code",
                isChecked: false,
              },
              // Net-new step -> kept and reparented to kagelin-root-100
              { id: "ms-step-new", displayName: "Set cookie", isChecked: true },
            ],
          },
        ],
      },
    );

    const preview = planMicrosoftTasksImport(dataset, workspace);

    // ms-root-1 is duplicate (1), ms-step-dup is duplicate (1) -> total 2 duplicates skipped
    expect(preview.duplicatesCount).toBe(2);
    expect(preview.stepsReassigned).toBe(1);
    expect(preview.totalTasks).toBe(0); // 0 root tasks kept
    expect(preview.totalSteps).toBe(1); // 1 step kept

    const plan = preview.projects[0];
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].id).toBe("ms-step-new");
    expect(plan.tasks[0].parentId).toBe("kagelin-root-100");
    expect(plan.tasks[0].isStep).toBe(true);
    expect(plan.tasks[0].isCompleted).toBe(true);
  });

  it("handles duplicate root tasks and duplicate steps within the same imported list", () => {
    const dataset = createDataset([{ id: "list-1", displayName: "Personal" }], {
      "list-1": [
        {
          id: "task-a",
          title: "Call dentist",
          checklistItems: [{ id: "step-a1", displayName: "Find number" }],
        },
        // Duplicate root in same import
        {
          id: "task-b",
          title: "Call dentist",
          checklistItems: [
            // Duplicate step in same import under task-a
            { id: "step-b1", displayName: "Find number" },
            // Net-new step
            { id: "step-b2", displayName: "Book appointment" },
          ],
        },
      ],
    });

    const preview = planMicrosoftTasksImport(dataset, emptyWorkspace);

    // task-b duplicate of task-a (1), step-b1 duplicate of step-a1 (1) -> 2 skipped
    expect(preview.duplicatesCount).toBe(2);
    expect(preview.totalTasks).toBe(1); // 1 root task kept (task-a)
    expect(preview.totalSteps).toBe(2); // 2 steps kept (step-a1, step-b2)
    expect(preview.stepsReassigned).toBe(1); // step-b2 reassigned to task-a

    const stepB2 = preview.projects[0].tasks.find((t) => t.id === "step-b2");
    expect(stepB2).toBeDefined();
    expect(stepB2?.parentId).toBe("task-a");
  });
});
