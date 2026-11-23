import { describe, it, expect } from "vitest";
import { planTickTickImport } from "@/lib/import/ticktick/plan";
import type {
  MappedTickTickTask,
  ExistingWorkspace,
} from "@/lib/import/ticktick/types";
import { PROJECT_COLORS } from "@/lib/constants/colors";

function createMockTask(
  overrides: Partial<MappedTickTickTask>,
): MappedTickTickTask {
  return {
    tempId: overrides.tempId ?? crypto.randomUUID(),
    tempParentId: overrides.tempParentId ?? null,
    originalTaskId: overrides.originalTaskId ?? crypto.randomUUID(),
    originalParentId: overrides.originalParentId ?? null,
    content: overrides.content ?? "Sample Task",
    description: overrides.description ?? null,
    priority: overrides.priority ?? 4,
    dueDate: overrides.dueDate ?? null,
    doDate: overrides.doDate ?? null,
    is_completed: overrides.is_completed ?? false,
    completedAt: overrides.completedAt ?? null,
    recurrence: overrides.recurrence ?? null,
    listName: overrides.listName ?? "Inbox",
    folderName: overrides.folderName ?? null,
    dayOrder: overrides.dayOrder ?? 0,
    originalDepth: overrides.originalDepth ?? (overrides.tempParentId ? 1 : 0),
  };
}

describe("planTickTickImport (Planning & Deduplication Engine)", () => {
  const emptyWorkspace: ExistingWorkspace = {
    projects: [],
    tasks: [],
  };

  it("plans fresh import into an empty workspace: assigns Inbox and formats 'Folder / List' names", () => {
    const tasks: MappedTickTickTask[] = [
      createMockTask({
        tempId: "task-inbox",
        content: "Buy groceries",
        listName: "Inbox",
        folderName: null,
      }),
      createMockTask({
        tempId: "task-work-root",
        content: "Ship Kagelin v1",
        listName: "Engineering",
        folderName: "Work",
        dueDate: "2026-11-25T00:00:00.000Z",
      }),
      createMockTask({
        tempId: "task-work-sub",
        tempParentId: "task-work-root",
        content: "Write unit tests",
        listName: "Engineering",
        folderName: "Work",
      }),
    ];

    const preview = planTickTickImport(tasks, emptyWorkspace);

    expect(preview.totalTasks).toBe(3);
    expect(preview.rootTasksCount).toBe(2);
    expect(preview.subtasksCount).toBe(1);
    expect(preview.duplicateTasksSkipped).toBe(0);
    expect(preview.subtasksReassigned).toBe(0);
    expect(preview.newProjectCount).toBe(1);
    expect(preview.mergedProjectCount).toBe(0);
    expect(preview.isQuotaLimited).toBe(false);

    const inboxPlan = preview.projects.find((p) => p.isInbox);
    expect(inboxPlan).toBeDefined();
    expect(inboxPlan?.name).toBe("Inbox");
    expect(inboxPlan?.status).toBe("inbox");
    expect(inboxPlan?.tasks).toHaveLength(1);

    const workPlan = preview.projects.find(
      (p) => p.name === "Work / Engineering",
    );
    expect(workPlan).toBeDefined();
    expect(workPlan?.status).toBe("new");
    expect(workPlan?.existingProjectId).toBeNull();
    expect(PROJECT_COLORS.map((c) => c.hex)).toContain(workPlan?.color);
    expect(workPlan?.tasks).toHaveLength(2);

    expect(workPlan?.tasks[0].tempParentId).toBeNull();
    expect(workPlan?.tasks[1].tempParentId).toBe("task-work-root");
  });

  it("merges into existing workspace projects by normalized name (case-insensitive)", () => {
    const workspace: ExistingWorkspace = {
      projects: [
        { id: "proj-work-123", name: "Work / Engineering", is_inbox: false },
        { id: "proj-inbox-0", name: "Inbox", is_inbox: true },
      ],
      tasks: [],
    };

    const tasks: MappedTickTickTask[] = [
      createMockTask({
        tempId: "task-1",
        content: "Task in existing project",
        listName: "engineering",
        folderName: "work",
      }),
      createMockTask({
        tempId: "task-2",
        content: "Task in inbox",
        listName: "inbox",
        folderName: "",
      }),
    ];

    const preview = planTickTickImport(tasks, workspace);

    const workPlan = preview.projects.find(
      (p) => p.name === "Work / Engineering",
    );
    expect(workPlan?.status).toBe("merged");
    expect(workPlan?.existingProjectId).toBe("proj-work-123");

    const inboxPlan = preview.projects.find((p) => p.isInbox);
    expect(inboxPlan?.status).toBe("inbox");
    expect(inboxPlan?.existingProjectId).toBe("proj-inbox-0");

    expect(preview.mergedProjectCount).toBe(1);
  });

  it("deduplicates root tasks against workspace and reparents child steps to existing Kagelin parent ID", () => {
    const workspace: ExistingWorkspace = {
      projects: [{ id: "proj-work", name: "Work", is_inbox: false }],
      tasks: [
        {
          id: "existing-root-task-id",
          content: "Launch Product",
          project_id: "proj-work",
          parent_id: null,
          is_completed: false,
        },
        {
          id: "existing-step-id",
          content: "Existing step",
          project_id: "proj-work",
          parent_id: "existing-root-task-id",
          is_completed: false,
        },
      ],
    };

    const rootTempId = "incoming-root";
    const tasks: MappedTickTickTask[] = [
      createMockTask({
        tempId: rootTempId,
        content: "launch product",
        listName: "Work",
        folderName: null,
      }),
      createMockTask({
        tempId: "incoming-step-new",
        tempParentId: rootTempId,
        content: "Draft announcement blog",
        listName: "Work",
        folderName: null,
      }),
      createMockTask({
        tempId: "incoming-step-dup",
        tempParentId: rootTempId,
        content: "existing step",
        listName: "Work",
        folderName: null,
      }),
    ];

    const preview = planTickTickImport(tasks, workspace);

    expect(preview.duplicateTasksSkipped).toBe(2);
    expect(preview.subtasksReassigned).toBe(1);
    expect(preview.totalTasks).toBe(1);

    const workPlan = preview.projects.find((p) => p.name === "Work")!;
    expect(workPlan.parentRedirects[rootTempId]).toEqual({
      kind: "existing",
      taskId: "existing-root-task-id",
    });

    expect(preview.parentRedirects[rootTempId]).toEqual({
      kind: "existing",
      taskId: "existing-root-task-id",
    });

    const keptStep = workPlan.tasks[0];
    expect(keptStep.content).toBe("Draft announcement blog");
    expect(keptStep.originalParentId).toBe("existing-root-task-id");
  });

  it("deduplicates duplicate root tasks within the same import batch and resolves parentRedirects to imported root", () => {
    const tasks: MappedTickTickTask[] = [
      createMockTask({
        tempId: "root-1",
        content: "Prepare release notes",
        listName: "Inbox",
      }),
      createMockTask({
        tempId: "root-2",
        content: "Prepare release notes",
        listName: "Inbox",
      }),
      createMockTask({
        tempId: "step-for-root-2",
        tempParentId: "root-2",
        content: "Proofread notes",
        listName: "Inbox",
      }),
    ];

    const preview = planTickTickImport(tasks, emptyWorkspace);

    expect(preview.duplicateTasksSkipped).toBe(1);
    expect(preview.subtasksReassigned).toBe(1);
    expect(preview.totalTasks).toBe(2);

    const inboxPlan = preview.projects.find((p) => p.isInbox)!;
    expect(inboxPlan.parentRedirects["root-2"]).toEqual({
      kind: "imported",
      tempId: "root-1",
    });

    const keptStep = inboxPlan.tasks.find(
      (t) => t.tempId === "step-for-root-2",
    );
    expect(keptStep?.tempParentId).toBe("root-1");
  });

  it("enforces Guest mode quota limits when task count exceeds 500, bounding to active and recent completed tasks", () => {
    const now = new Date("2026-11-23T12:00:00.000Z");
    const oldCompletedDate = new Date("2026-09-01T00:00:00.000Z").toISOString();
    const recentCompletedDate = new Date(
      "2026-11-15T00:00:00.000Z",
    ).toISOString();

    const tasks: MappedTickTickTask[] = [];

    for (let i = 0; i < 300; i++) {
      tasks.push(
        createMockTask({
          tempId: `active-${i}`,
          content: `Active Task ${i}`,
          is_completed: false,
          listName: "Work",
        }),
      );
    }
    for (let i = 0; i < 100; i++) {
      tasks.push(
        createMockTask({
          tempId: `recent-${i}`,
          content: `Recent Completed ${i}`,
          is_completed: true,
          completedAt: recentCompletedDate,
          listName: "Work",
        }),
      );
    }
    for (let i = 0; i < 150; i++) {
      tasks.push(
        createMockTask({
          tempId: `old-${i}`,
          content: `Old Completed ${i}`,
          is_completed: true,
          completedAt: oldCompletedDate,
          listName: "Work",
        }),
      );
    }

    expect(tasks.length).toBe(550);

    const guestPreview = planTickTickImport(tasks, emptyWorkspace, {
      isGuest: true,
      refDate: now,
    });

    expect(guestPreview.isQuotaLimited).toBe(true);
    expect(guestPreview.totalTasks).toBe(400);

    const registeredPreview = planTickTickImport(tasks, emptyWorkspace, {
      isGuest: false,
      refDate: now,
    });

    expect(registeredPreview.isQuotaLimited).toBe(false);
    expect(registeredPreview.totalTasks).toBe(550);
  });
});
