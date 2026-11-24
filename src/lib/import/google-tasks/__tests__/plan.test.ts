import { describe, it, expect } from "vitest";
import { planGoogleTasksImport } from "../plan";
import type { GoogleTasksDataset, ExistingWorkspace } from "../types";
import { PROJECT_COLORS } from "@/lib/constants/colors";

function createDataset(
  lists: Array<{ id: string; title: string }>,
  tasksByListId: Record<
    string,
    Array<{
      id: string;
      title: string;
      notes?: string;
      due?: string;
      status?: "needsAction" | "completed";
      parent?: string;
      position?: string;
    }>
  >,
): GoogleTasksDataset {
  return {
    lists,
    tasksByListId: Object.fromEntries(
      Object.entries(tasksByListId).map(([listId, tasks]) => [
        listId,
        tasks.map((t) => ({
          id: t.id,
          title: t.title,
          notes: t.notes,
          due: t.due,
          status: t.status ?? "needsAction",
          parent: t.parent,
          position: t.position,
        })),
      ]),
    ),
  };
}

describe("planGoogleTasksImport (Deduplication & Planning Engine)", () => {
  const emptyWorkspace: ExistingWorkspace = {
    projects: [],
    tasks: [],
  };

  it("plans fresh import into an empty workspace: assigns Inbox and new projects", () => {
    const dataset = createDataset(
      [
        { id: "@default", title: "My Tasks" },
        { id: "list-work", title: "Work Projects" },
      ],
      {
        "@default": [
          {
            id: "task-1",
            title: "Buy groceries",
            due: "2026-11-20T00:00:00.000Z",
          },
        ],
        "list-work": [
          {
            id: "task-2",
            title: "Ship Kagelin v1",
            due: "2026-11-25T00:00:00.000Z",
          },
          { id: "task-3", title: "Write tests", parent: "task-2" },
        ],
      },
    );

    const preview = planGoogleTasksImport(dataset, emptyWorkspace);

    expect(preview.totalTasks).toBe(3);
    expect(preview.rootTasksCount).toBe(2);
    expect(preview.subtasksCount).toBe(1);
    expect(preview.duplicateTasksSkipped).toBe(0);
    expect(preview.subtasksReassigned).toBe(0);
    expect(preview.newProjectCount).toBe(1);
    expect(preview.mergedProjectCount).toBe(0);
    expect(preview.earliestDate).toBe("2026-11-20T00:00:00.000Z");
    expect(preview.latestDate).toBe("2026-11-25T00:00:00.000Z");
    expect(preview.rawSource).toBe(dataset);

    const inboxPlan = preview.projects.find((p) => p.isInbox);
    expect(inboxPlan).toBeDefined();
    expect(inboxPlan?.status).toBe("inbox");
    expect(inboxPlan?.tasks).toHaveLength(1);

    const workPlan = preview.projects.find((p) => p.name === "Work Projects");
    expect(workPlan).toBeDefined();
    expect(workPlan?.status).toBe("new");
    expect(workPlan?.existingProjectId).toBeNull();
    expect(PROJECT_COLORS.map((c) => c.hex)).toContain(workPlan?.color);
    expect(workPlan?.tasks).toHaveLength(2);
  });

  it("merges into existing workspace projects by normalized name (case-insensitive)", () => {
    const workspace: ExistingWorkspace = {
      projects: [
        { id: "proj-work-123", name: "work projects", is_inbox: false },
      ],
      tasks: [],
    };

    const dataset = createDataset(
      [{ id: "list-work", title: "Work Projects" }],
      {
        "list-work": [{ id: "task-1", title: "New Task" }],
      },
    );

    const preview = planGoogleTasksImport(dataset, workspace);

    expect(preview.mergedProjectCount).toBe(1);
    expect(preview.newProjectCount).toBe(0);
    const plan = preview.projects[0];
    expect(plan.status).toBe("merged");
    expect(plan.existingProjectId).toBe("proj-work-123");
  });

  it("skips duplicate root tasks matching active workspace tasks by (project_id, normalized_title)", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "proj-work", name: "Work", is_inbox: false }],
      tasks: [
        {
          id: "existing-root-1",
          content: "Ship Kagelin v1",
          project_id: "proj-work",
          parent_id: null,
          is_completed: false,
        },
      ],
    };

    const dataset = createDataset([{ id: "list-work", title: "Work" }], {
      "list-work": [
        { id: "gt-root-1", title: "  ship kagelin v1  " },
        { id: "gt-root-2", title: "Write documentation" },
      ],
    });

    const preview = planGoogleTasksImport(dataset, workspace);

    expect(preview.duplicateTasksSkipped).toBe(1);
    expect(preview.totalTasks).toBe(1);
    const workPlan = preview.projects[0];
    expect(workPlan.duplicatesSkipped).toBe(1);
    expect(workPlan.tasks).toHaveLength(1);
    expect(workPlan.tasks[0].content).toBe("Write documentation");
    expect(workPlan.parentRedirects["gt-root-1"]).toEqual({
      kind: "existing",
      taskId: "existing-root-1",
    });
  });

  it("does not treat completed workspace tasks as duplicates", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "proj-work", name: "Work", is_inbox: false }],
      tasks: [
        {
          id: "existing-completed-1",
          content: "Old Task",
          project_id: "proj-work",
          parent_id: null,
          is_completed: true,
        },
      ],
    };

    const dataset = createDataset([{ id: "list-work", title: "Work" }], {
      "list-work": [{ id: "gt-task-1", title: "Old Task" }],
    });

    const preview = planGoogleTasksImport(dataset, workspace);

    expect(preview.duplicateTasksSkipped).toBe(0);
    expect(preview.totalTasks).toBe(1);
    expect(preview.projects[0].tasks).toHaveLength(1);
  });

  it("redirects subtasks of a skipped root task to existing Kagelin root task ID via parentRedirects", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "proj-work", name: "Work", is_inbox: false }],
      tasks: [
        {
          id: "existing-kagelin-root",
          content: "Launch Product",
          project_id: "proj-work",
          parent_id: null,
          is_completed: false,
        },
      ],
    };

    const dataset = createDataset([{ id: "list-work", title: "Work" }], {
      "list-work": [
        { id: "gt-root", title: "Launch Product" },
        { id: "gt-child-1", title: "Prepare press release", parent: "gt-root" },
        { id: "gt-child-2", title: "Deploy to production", parent: "gt-root" },
      ],
    });

    const preview = planGoogleTasksImport(dataset, workspace);

    expect(preview.duplicateTasksSkipped).toBe(1);
    expect(preview.subtasksReassigned).toBe(2);
    expect(preview.totalTasks).toBe(2);

    const workPlan = preview.projects[0];
    expect(workPlan.parentRedirects["gt-root"]).toEqual({
      kind: "existing",
      taskId: "existing-kagelin-root",
    });

    expect(workPlan.tasks).toHaveLength(2);
    expect(workPlan.tasks[0].parentId).toBe("existing-kagelin-root");
    expect(workPlan.tasks[1].parentId).toBe("existing-kagelin-root");
  });

  it("skips duplicate subtasks matching active workspace subtasks by (parent_id, normalized_title)", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "proj-work", name: "Work", is_inbox: false }],
      tasks: [
        {
          id: "existing-kagelin-root",
          content: "Launch Product",
          project_id: "proj-work",
          parent_id: null,
          is_completed: false,
        },
        {
          id: "existing-subtask-1",
          content: "Prepare press release",
          project_id: "proj-work",
          parent_id: "existing-kagelin-root",
          is_completed: false,
        },
      ],
    };

    const dataset = createDataset([{ id: "list-work", title: "Work" }], {
      "list-work": [
        { id: "gt-root", title: "Launch Product" },
        { id: "gt-child-1", title: "prepare press release", parent: "gt-root" },
        { id: "gt-child-2", title: "Deploy to production", parent: "gt-root" },
      ],
    });

    const preview = planGoogleTasksImport(dataset, workspace);

    expect(preview.duplicateTasksSkipped).toBe(2);
    expect(preview.subtasksReassigned).toBe(1);
    expect(preview.totalTasks).toBe(1);

    const workPlan = preview.projects[0];
    expect(workPlan.tasks).toHaveLength(1);
    expect(workPlan.tasks[0].content).toBe("Deploy to production");
    expect(workPlan.tasks[0].parentId).toBe("existing-kagelin-root");
  });

  it("skips intra-dataset duplicate root tasks and redirects their subtasks to the first root", () => {
    const dataset = createDataset([{ id: "list-1", title: "Personal" }], {
      "list-1": [
        { id: "gt-root-a", title: "Same Title" },
        { id: "gt-child-a", title: "Child A", parent: "gt-root-a" },
        { id: "gt-root-b", title: "Same Title" },
        { id: "gt-child-b", title: "Child B", parent: "gt-root-b" },
      ],
    });

    const preview = planGoogleTasksImport(dataset, emptyWorkspace);

    expect(preview.duplicateTasksSkipped).toBe(1);
    expect(preview.subtasksReassigned).toBe(1);
    expect(preview.totalTasks).toBe(3);

    const plan = preview.projects[0];
    expect(plan.parentRedirects["gt-root-b"]).toEqual({
      kind: "imported",
      tempId: "gt-root-a",
    });

    const childB = plan.tasks.find((t) => t.id === "gt-child-b");
    expect(childB).toBeDefined();
    expect(childB?.parentId).toBe("gt-root-a");
  });

  it("skips intra-dataset duplicate subtasks under the same root", () => {
    const dataset = createDataset([{ id: "list-1", title: "Personal" }], {
      "list-1": [
        { id: "root-1", title: "My Project" },
        { id: "sub-1", title: "Task X", parent: "root-1" },
        { id: "sub-2", title: "task x", parent: "root-1" },
      ],
    });

    const preview = planGoogleTasksImport(dataset, emptyWorkspace);

    expect(preview.duplicateTasksSkipped).toBe(1);
    expect(preview.totalTasks).toBe(2);
    expect(preview.projects[0].tasks).toHaveLength(2);
  });

  it("matches Inbox workspace tasks with both null project_id and is_inbox project id", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "proj-inbox", name: "Inbox", is_inbox: true }],
      tasks: [
        {
          id: "task-null-proj",
          content: "Inbox Task 1",
          project_id: null,
          parent_id: null,
          is_completed: false,
        },
        {
          id: "task-inbox-proj",
          content: "Inbox Task 2",
          project_id: "proj-inbox",
          parent_id: null,
          is_completed: false,
        },
      ],
    };

    const dataset = createDataset([{ id: "@default", title: "@default" }], {
      "@default": [
        { id: "gt-1", title: "Inbox Task 1" },
        { id: "gt-2", title: "Inbox Task 2" },
        { id: "gt-3", title: "Inbox Task 3" },
      ],
    });

    const preview = planGoogleTasksImport(dataset, workspace);

    expect(preview.duplicateTasksSkipped).toBe(2);
    expect(preview.totalTasks).toBe(1);
    expect(preview.projects[0].tasks[0].content).toBe("Inbox Task 3");
  });

  it("does not treat a non-default list titled 'Inbox' as system inbox", () => {
    const dataset = createDataset(
      [{ id: "list-custom-inbox", title: "Inbox" }],
      {
        "list-custom-inbox": [{ id: "task-1", title: "Some task" }],
      },
    );

    const preview = planGoogleTasksImport(dataset, emptyWorkspace);

    expect(preview.projects).toHaveLength(1);
    const plan = preview.projects[0];
    expect(plan.isInbox).toBe(false);
    expect(plan.status).toBe("new");
    expect(plan.name).toBe("Inbox");
  });

  it("skips empty task lists", () => {
    const dataset = createDataset(
      [
        { id: "empty-list-1", title: "Empty List 1" },
        { id: "active-list", title: "Active List" },
        { id: "empty-list-2", title: "Empty List 2" },
      ],
      {
        "empty-list-1": [],
        "active-list": [{ id: "task-1", title: "Active task" }],
        "empty-list-2": [],
      },
    );

    const preview = planGoogleTasksImport(dataset, emptyWorkspace);

    expect(preview.projects).toHaveLength(1);
    expect(preview.projects[0].name).toBe("Active List");
  });
});
